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
        console.log("   📦 Raw Payload:", JSON.stringify(decoded));

        const extractId = (val: any): string | null => {
            if (!val) return null;
            if (typeof val === 'string') {
                return (val !== '[object Object]' && val.length > 5) ? val : null;
            }
            if (typeof val === 'object') {
                // If it's a Mongoose object or something with _id/id
                const candidate = val.id || val._id || val.sub;
                if (candidate) return extractId(candidate);

                // If it's the raw payload itself and has 'user' property
                if (val.user) return extractId(val.user);

                // Fallback to string representation if it looks like a hex ID
                const str = val.toString();
                return (str !== '[object Object]' && str.length > 5) ? str : null;
            }
            return null;
        };

        const userId = extractId(decoded);

        if (!userId) {
            console.error("   ❌ Auth Error: No valid User ID in payload");
            return next(new Error('Authentication error: Invalid user identity in token'));
        }

        (socket as AuthSocket).user = {
            _id: userId,
            role: (decoded.user?.role || decoded.role || 'user').toString(),
            name: (decoded.user?.name || decoded.name || 'User').toString()
        };

        console.log(`   ✅ Auth Success: ${userId}`);
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};
