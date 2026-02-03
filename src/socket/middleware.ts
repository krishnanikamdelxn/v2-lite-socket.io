import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import * as cookie from 'cookie';
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
        try {
            const cookies = cookie.parse(cookieHeader);
            token = cookies.app_session;
        } catch (e) {
            console.error("🔍 [AUTH] Cookie parse failed:", e);
        }
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

            // 1. If it's already a valid string
            if (typeof val === 'string') {
                return (val !== '[object Object]' && val.length > 5) ? val : null;
            }

            // 2. Handle Binary Buffer Object (smoking gun)
            if (typeof val === 'object') {
                // If it's the raw buffer object or nested under .buffer or ._id
                const target = val.buffer || val._id || val.id || val;

                // Check if it's the specific { "0": 105, ... } structure seen in logs
                const bufferObj = (target && typeof target === 'object' && target.buffer) ? target.buffer : target;

                if (bufferObj && typeof bufferObj === 'object' && ('0' in bufferObj || 'data' in bufferObj)) {
                    try {
                        const data = bufferObj.data || Object.values(bufferObj);
                        const bytes = data as number[];
                        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
                        if (hex.length === 24) return hex;
                    } catch (e) {
                        // fallback to recursion
                    }
                }

                // 3. Recursive check for common keys
                if (val.user) return extractId(val.user);
                if (val._id && val._id !== val) return extractId(val._id);
                if (val.id && val.id !== val) return extractId(val.id);
                if (val.sub) return extractId(val.sub);
            }
            return null;
        };

        const userId = extractId(decoded);

        if (!userId) {
            console.error("   ❌ [AUTH] No valid ID found. Payload:", JSON.stringify(decoded));
            return next(new Error('Authentication error: Invalid user identity in token'));
        }

        (socket as AuthSocket).user = {
            _id: userId,
            role: (decoded.role || decoded.user?.role || 'user').toString(),
            name: (decoded.name || decoded.user?.name || 'User').toString()
        };

        console.log(`   ✅ [AUTH] Success: ${userId}`);
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};
