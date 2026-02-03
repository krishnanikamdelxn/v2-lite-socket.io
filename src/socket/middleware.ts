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
    console.log("🔌 New Connection Attempt:", socket.id);
    console.log("   Headers:", socket.handshake.headers);
    console.log("   Auth:", socket.handshake.auth);

    const cookieHeader = socket.handshake.headers.cookie;
    let token = null;

    if (cookieHeader) {
        const cookies = cookie.parse(cookieHeader);
        token = cookies.app_session;
    }

    // Fallback: Check auth object (handshake)
    if (!token && socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
    }

    // Fallback: Check Authorization header
    if (!token && socket.handshake.headers.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }

    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

        // Define a helper to extract ID safely
        const extractId = (obj: any): string | null => {
            if (!obj) return null;
            if (typeof obj === 'string') return obj;
            if (typeof obj === 'object') {
                return obj.id || obj._id || null;
            }
            return null;
        };

        // Normalized user object from payload (handles flat, nested 'user')
        const userPayload = (decoded.user && typeof decoded.user === 'object') ? decoded.user : decoded;
        const rawId = userPayload.id || userPayload._id;
        const userId = extractId(rawId);

        if (!userId || typeof userId !== 'string') {
            console.error("   ❌ Auth Error: No valid user ID found in token payload:", JSON.stringify(decoded));
            return next(new Error('Authentication error: No user ID in token'));
        }

        (socket as AuthSocket).user = {
            _id: userId,
            role: userPayload.role || 'user',
            name: userPayload.name || 'User'
        };

        console.log("   ✅ User Authenticated:", userId, `(${userPayload.role})`);
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};
