import ChatRoom, { IChatRoom } from '../models/ChatRoom';
import Message, { IMessage } from '../models/Message';
import mongoose from 'mongoose';

export const saveMessage = async (
    roomId: string,
    senderId: string,
    content: string,
    type: "text" | "image" | "file" | "system",
    fileUrl?: string
): Promise<IMessage> => {
    const message = await Message.create({
        roomId: roomId as any,
        senderId: senderId as any,
        content,
        type,
        fileUrl
    });

    await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: (message as any)._id });
    return message as unknown as IMessage;
};

import Project from '../models/Project';
import User from '../models/User';

export const getOrCreateChatRoom = async (projectId: string, userId: string): Promise<IChatRoom | null> => {
    // 1. Validate ID formats
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
        console.error(`❌ [SERVICE] Invalid ID format. Project: ${projectId}, User: ${userId}`);
        throw new Error("Invalid Project or User ID format");
    }

    const pId = new mongoose.Types.ObjectId(projectId);
    const uId = new mongoose.Types.ObjectId(userId);

    // 2. User is already authenticated via JWT token in socket middleware
    // No need to re-verify in database - trust the authentication layer
    console.log(`[Chat Service] Getting/Creating room for Project: ${projectId}, User: ${userId}`);

    // 3. Find or Create Room
    // We trust that the client app has already validated the project exists
    // No need to verify project in socket server - it's a separate concern
    let room = await ChatRoom.findOne({ projectId: pId } as any);

    if (!room) {
        // Create new room with the requesting user as initial member
        console.log(`[Chat Service] Creating new chat room for project ${projectId}`);
        room = await ChatRoom.create({
            type: "project",
            projectId: pId as any,
            members: [uId as any]
        });
        console.log(`✅ [Chat Service] Room created: ${room._id}`);
    } else {
        // Room exists - ensure current user is in members list
        if (!room.members.map(m => m.toString()).includes(uId.toString())) {
            console.log(`[Chat Service] Adding user ${userId} to existing room ${room._id}`);
            room.members.push(uId as any);
            await room.save();
        } else {
            console.log(`[Chat Service] User already in room ${room._id}`);
        }
    }

    return room;
};

export const verifyUserInRoom = async (userId: string, roomId: string): Promise<boolean> => {
    const room = await ChatRoom.findById(roomId);
    if (!room) return false;
    return room.members.some(memberId => memberId.toString() === userId.toString());
};

export const markMessagesAsRead = async (roomId: string, userId: string, messageIds: string[]) => {
    await Message.updateMany(
        { _id: { $in: messageIds }, roomId } as any,
        { $addToSet: { readBy: { user: userId, readAt: new Date() } } }
    );
};

// ============================================
// 🔔 PUSH NOTIFICATION FOR CHAT MESSAGES
// ============================================
import { sendPushNotification } from './pushNotification';

export const sendChatPushNotification = async (
    recipientId: string,
    senderName: string,
    messagePreview: string,
    projectId: string
): Promise<void> => {
    try {
        await sendPushNotification(
            recipientId,
            `💬 ${senderName}`,
            messagePreview,
            {
                type: 'chat_message',
                screen: 'ProjectChatScreen',
                params: { projectId }
            }
        );
    } catch (error) {
        console.error('[Chat Push] Error:', error);
    }
};

// ============================================
// 📊 UNREAD MESSAGE COUNT
// ============================================
export const getUnreadCount = async (userId: string): Promise<number> => {
    try {
        // Find all rooms the user is a member of
        const rooms = await ChatRoom.find({ members: userId } as any);
        const roomIds = rooms.map(r => r._id);

        // Count messages not read by this user
        const count = await Message.countDocuments({
            roomId: { $in: roomIds },
            senderId: { $ne: userId },
            'readBy.user': { $ne: userId },
            isDeleted: false
        } as any);

        return count;
    } catch (error) {
        console.error('[Unread Count] Error:', error);
        return 0;
    }
};

export const getProjectUnreadCounts = async (userId: string): Promise<Record<string, number>> => {
    try {
        const rooms = await ChatRoom.find({ members: userId } as any);
        const counts: Record<string, number> = {};

        for (const room of rooms) {
            const count = await Message.countDocuments({
                roomId: room._id,
                senderId: { $ne: userId },
                'readBy.user': { $ne: userId },
                isDeleted: false
            } as any);

            if (room.projectId) {
                counts[room.projectId.toString()] = count;
            }
        }

        return counts;
    } catch (error) {
        console.error('[Project Unread Counts] Error:', error);
        return {};
    }
};
