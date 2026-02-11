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
                const safeUserId = String(_id);
                const safeProjectId = String(projectId);

                console.log(`[DEBUG] Join Attempt: Project=${safeProjectId}, User=${safeUserId}`);

                // 1. Get or Create Room
                const room = await chatService.getOrCreateChatRoom(safeProjectId, safeUserId);

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

                // Mobile app expects 'sender' (the ID) for bubble alignment logic
                // No need to populate user data - we already have it from socket auth
                const mobileCompatibleMessage = {
                    ...message.toObject(),
                    sender: _id.toString(), // Add 'sender' for mobile compatibility
                    senderId: {
                        _id: _id.toString(),
                        name: name
                    },
                    id: message._id.toString()
                };

                io.to(room._id.toString()).emit('receive_message', mobileCompatibleMessage);

                // ============================================
                // 🔔 SEND NOTIFICATIONS TO OTHER ROOM MEMBERS
                // ============================================
                const senderName = name || 'Someone';
                const notificationTitle = `💬 New Message`;
                const notificationBody = content.length > 50 ? content.substring(0, 50) + '...' : content;

                // Get all room members except sender, and deduplicate
                const recipientIds = Array.from(new Set(
                    room.members
                        .filter((memberId: any) => memberId.toString() !== _id.toString())
                        .map((memberId: any) => memberId.toString())
                ));

                for (const recipientIdStr of recipientIds) {
                    // 1. Emit in-app toast notification via socket
                    // This is for real-time foreground feedback
                    io.to(recipientIdStr).emit('notification', {
                        type: 'chat_message',
                        title: notificationTitle,
                        message: `${senderName}: ${notificationBody}`,
                        userId: recipientIdStr,
                        screen: 'ProjectChatScreen',
                        params: { projectId }
                    });

                    // 2. Send push notification
                    // This is for offline/backgrounded users
                    chatService.sendChatPushNotification(
                        recipientIdStr,
                        senderName,
                        notificationBody,
                        projectId
                    );
                }

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

        // ============================================
        // 🔔 NOTIFICATION RELAY HANDLERS
        // ============================================

        // Relay notification to specific user (by userId in payload)
        socket.on('notification', (data: Record<string, unknown>) => {
            console.log(`[SocketServer] Relaying notification:`, data);
            // Broadcast to all clients (each client filters by userId)
            socket.broadcast.emit('notification', data);
        });

        // Relay announcement to all users
        socket.on('announcement:new', (data: Record<string, unknown>) => {
            console.log(`[SocketServer] Relaying announcement:`, data);
            // Broadcast to all connected clients
            socket.broadcast.emit('announcement:new', data);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${name}`);
        });
    });
};
