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
    // 0. Type check/Cast incoming IDs
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
        console.error(`❌ [SERVICE] Invalid ID format. Project: ${projectId}, User: ${userId}`);
        throw new Error("Invalid Project or User ID format");
    }

    const pId = new mongoose.Types.ObjectId(projectId);
    const uId = new mongoose.Types.ObjectId(userId);

    // 1. Verify Project Exists
    const project = await Project.findById(pId);
    if (!project) {
        throw new Error("Project not found");
    }

    // 2. Fetch User to check Role
    const user = await User.findById(uId);
    if (!user) {
        throw new Error("User not found");
    }

    // 3. Authorization Check
    // Global Admin, Project Manager, or Client are allowed.
    const isAdmin = user.role === 'admin';
    const isManager = project.manager.toString() === uId.toString();
    const isClient = user.role === 'client' && project.clientEmail === user.email;

    if (!isAdmin && !isManager && !isClient) {
        // Fallback: Check if we can find the client user object if not manually linked
        if (project.clientEmail && user.email === project.clientEmail) {
            // Authorized as Client
        } else {
            console.error(`❌ [AUTH] Denied Access: User=${uId} (Role=${user.role}), Project=${pId}`);
            throw new Error("Unauthorized: Only Admins, Project Managers, and the assigned Client can access this chat.");
        }
    }

    // 4. Find or Create Room
    // Cast to any to avoid TS mismatch between string ID and ObjectId
    let room = await ChatRoom.findOne({ projectId: pId } as any);

    if (!room) {
        // Resolve Member IDs
        // We know Manager ID
        const members: any[] = [project.manager];

        // Resolve Client ID
        let clientId = null;
        if (user.role === 'client' && user.email === project.clientEmail) {
            clientId = user._id;
        } else if (project.clientEmail) {
            const clientUser = await User.findOne({ email: project.clientEmail });
            if (clientUser) clientId = clientUser._id;
        }

        if (clientId) members.push(clientId);

        // Add the creator if they are an Admin/Manager but not the default manager
        if (uId.toString() !== project.manager.toString()) {
            members.push(uId);
        }

        room = await ChatRoom.create({
            type: "project",
            projectId: pId as any,
            members: members
        });
    } else {
        // Ensure current user is in members list if authorized (sync)
        if (!room.members.map(m => m.toString()).includes(uId.toString())) {
            room.members.push(uId as any);
            await room.save();
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
