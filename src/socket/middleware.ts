import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { ExtendedError } from 'socket.io/dist/namespace';

export interface AuthSocket extends Socket {
    user?: {
        _id: string;
        role: string;
        name: string;
    };
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: ExtendedError) => void) => {
    const cookieHeader = socket.handshake.headers.cookie;
    let token = null;

    if (cookieHeader) {
        const cookies = cookie.parse(cookieHeader);
        token = cookies.app_session;
    }

    if (!token && socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
    }

    if (!token && socket.handshake.headers.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) return next(new Error('Authentication error: No token provided'));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

        const extractId = (val: any): string | null => {
            if (!val) return null;
            if (typeof val === 'string') {
                return (val !== '[object Object]' && val.length > 5) ? val : null;
            }
            if (typeof val === 'object') {
                return extractId(val.id || val._id || val.sub);
            }
            return null;
        };

        const userId = extractId(decoded.user) || extractId(decoded);

        if (!userId) {
            console.error("❌ Auth Error: Could not find valid ID in payload:", JSON.stringify(decoded));
            return next(new Error('Authentication error: Invalid user identity in token'));
        }

        (socket as AuthSocket).user = {
            _id: userId,
            role: (decoded.user?.role || decoded.role || 'user').toString(),
            name: (decoded.user?.name || decoded.name || 'User').toString()
        };

        console.log(`✅ Socket Auth Success: ${userId} (${(socket as AuthSocket).user?.role})`);
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};
