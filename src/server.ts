import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db';
import { socketAuthMiddleware } from './socket/middleware';
import { handleSocketEvents } from './socket/events';

dotenv.config();
connectDB();

const app = express();
const httpServer = createServer(app);

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true
    }
});

import chatRoutes from './routes/chat.routes';

// Middleware
io.use(socketAuthMiddleware);

// Routes
app.use('/api/chat', chatRoutes);

// Events (for authenticated mobile clients)
handleSocketEvents(io);

// ============================================
// 🔔 RELAY NAMESPACE (for backend notifications)
// No authentication required for backend relay
// ============================================
const relayNamespace = io.of('/relay');

relayNamespace.on('connection', (socket) => {
    console.log(`[Relay] Backend connected: ${socket.id}`);

    // Relay notification to all authenticated clients
    socket.on('notification', (data) => {
        console.log(`[Relay] Broadcasting notification:`, data);
        // Emit to main namespace (all authenticated clients)
        io.emit('notification', data);
    });

    // Relay announcement to all clients
    socket.on('announcement:new', (data) => {
        console.log(`[Relay] Broadcasting announcement:`, data);
        io.emit('announcement:new', data);
    });

    socket.on('disconnect', () => {
        console.log(`[Relay] Backend disconnected: ${socket.id}`);
    });
});

app.get('/', (req, res) => {
    res.send('Socket Server is Running 🚀');
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
    console.log(`🚀 Socket Server [v1.0.5-FIX] running on port ${PORT}`);
});
