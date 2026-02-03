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
    // 1. Verify Project Exists
    const project = await Project.findById(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    // 2. Fetch User to check Role
    if (!userId || userId === "[object Object]") {
        console.error("❌ chat.service: Invalid userId received:", userId);
        throw new Error("Invalid user authentication");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    // 3. Authorization Check
    // Admin (Manager) or Client are allowed.
    const isManager = project.manager.toString() === userId;
    // Note: Assuming project has clientEmail, we might need to look up client user by email if client ID is not directly stored or check if user.email matches project.clientEmail
    // Based on the user's prompt, they want STRICT Admin and Client role check.

    // In the User model provided earlier, role is a string.
    const isClient = user.role === 'client' && project.clientEmail === user.email; // Basic check, ideally project should store clientId

    // Check if user is in engineers list (optional, based on requirement "admin and client role nothing else" -> usually engineers are also involved, but user said STRICTLY ADMIN AND CLIENT. 
    // "just admin can chat with client and same way client with admin". So engineers are OUT for now based on prompt.)

    if (!isManager && !isClient) {
        // Fallback: Check if we can find the client user object if not manually linked
        // If the user attempting to join IS the client email on file
        if (project.clientEmail && user.email === project.clientEmail) {
            // Authorized as Client
        } else {
            throw new Error("Unauthorized: Only Project Manager and Client can access this chat.");
        }
    }

    // 4. Find or Create Room
    // Cast to any to avoid TS mismatch between string ID and ObjectId
    let room = await ChatRoom.findOne({ projectId: projectId as any });

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

        room = await ChatRoom.create({
            type: "project",
            projectId: project._id as any,
            members: members
        });
    } else {
        // Ensure current user is in members list if authorized (sync)
        if (!room.members.map(m => m.toString()).includes(userId)) {
            room.members.push(userId as any);
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
