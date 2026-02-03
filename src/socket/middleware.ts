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
        (socket as AuthSocket).user = decoded;
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};
