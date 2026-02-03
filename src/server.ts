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

// Events
handleSocketEvents(io);

app.get('/', (req, res) => {
    res.send('Socket Server is Running 🚀');
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
    console.log(`🚀 Socket Server [v1.0.5-FIX] running on port ${PORT}`);
});
