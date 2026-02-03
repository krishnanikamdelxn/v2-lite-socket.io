import { Server, Socket } from 'socket.io';
import { AuthSocket } from './middleware';
import * as chatService from '../services/chat.service';

export const handleSocketEvents = (io: Server) => {
    io.on('connection', async (socket: Socket) => {
        const authSocket = socket as AuthSocket;
        if (!authSocket.user) {
            socket.disconnect();
            return;
        }

        const { _id, name } = authSocket.user;
        console.log(`🔌 User connected: ${name} (ID: ${_id})`);

        if (!_id) {
            console.error("❌ Socket Error: Connection established without user ID");
            socket.disconnect();
            return;
        }

        // Join user's private room
        socket.join(_id.toString());

        // Join Project Chat (Auto-Create/Get)
        socket.on('join_project_chat', async ({ projectId }: { projectId: string }) => {
            try {
                console.log(`[DEBUG] Join Attempt: Project=${projectId} (${typeof projectId}), User=${_id} (${typeof _id})`);
                // 1. Get or Create Room (this handles auth internally too)
                const room = await chatService.getOrCreateChatRoom(projectId, _id.toString());

                if (room) {
                    const roomId = room._id.toString();
                    socket.join(roomId);
                    socket.emit('room_joined', { roomId, projectId });
                    console.log(`User ${_id} joined project chat ${projectId} (Room: ${roomId})`);
                } else {
                    socket.emit('error', { message: 'Failed to access project chat' });
                }
            } catch (err: any) {
                console.error("Join Error:", err.message);
                socket.emit('error', { message: err.message || 'Error joining project chat' });
            }
        });

        // Send Message
        socket.on('send_message', async ({ projectId, content, type, fileUrl }: { projectId: string, content: string, type: "text" | "file", fileUrl?: string }) => {
            try {
                // Resolve Room ID from Project ID (for robustness, re-verify or cache)
                // For speed, client usually sends roomId if they joined, but let's support projectId lookup for ease
                const room = await chatService.getOrCreateChatRoom(projectId, _id.toString());
                if (!room) throw new Error("Room not found");

                const message = await chatService.saveMessage(room._id.toString(), _id.toString(), content, type, fileUrl);

                // Populate senderId for the broadcast
                const populatedMessage = await message.populate('senderId', 'name email');

                // Mobile app expects 'sender' (the ID) for bubble alignment logic
                const mobileCompatibleMessage = {
                    ...populatedMessage.toObject(),
                    sender: _id.toString(), // Add 'sender' for mobile compatibility
                    id: populatedMessage._id.toString()
                };

                io.to(room._id.toString()).emit('receive_message', mobileCompatibleMessage);
            } catch (err: any) {
                console.error("Send Message Error:", err.message);
                socket.emit('error', { message: 'Error sending message' });
            }
        });

        // Typing Indicators
        socket.on('typing_start', ({ roomId }: { roomId: string }) => {
            socket.to(roomId).emit('typing_start', { userId: _id, roomId });
        });

        socket.on('typing_stop', ({ roomId }: { roomId: string }) => {
            socket.to(roomId).emit('typing_stop', { userId: _id, roomId });
        });

        // Mark Read
        socket.on('mark_read', async ({ roomId, messageIds }: { roomId: string, messageIds: string[] }) => {
            try {
                await chatService.markMessagesAsRead(roomId, _id.toString(), messageIds);
                socket.to(roomId).emit('messages_read', { userId: _id, roomId, messageIds });
            } catch (err) {
                console.error('Error marking read:', err);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${name}`);
        });
    });
};
