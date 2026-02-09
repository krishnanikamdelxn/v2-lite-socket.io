
import { Request, Response } from 'express';
import Project from '../models/Project';
import ChatRoom from '../models/ChatRoom';
import Message from '../models/Message';
import { getOrCreateChatRoom } from '../services/chat.service';
import mongoose from 'mongoose'; // Added mongoose import

export const getProjectChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = req.params.projectId as string;

        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }

        // Defensive check for malformed IDs
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            console.error(`❌ [HISTORY] Invalid Project ID Format: "${projectId}" (Type: ${typeof projectId})`);
            res.status(400).json({ error: `Invalid project ID format: ${projectId}` });
            return;
        }

        // 1. Verify Project Exists
        const project = await Project.findById(projectId);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        // Actually, for REST fetch, just finding the room is safer/faster
        // The previous logic assumed messages were embedded in ChatRoom, which is incorrect.
        // We need to query the Message collection.
        const chatRoom = await ChatRoom.findOne({ projectId: projectId as any }); // Find the room to get its ID if needed, though not strictly necessary for fetching messages.

        if (!chatRoom) {
            // Return empty history if room doesn't exist yet
            res.json([]);
            return;
        }

        // Fetch messages from the Message collection, linking them to the found chatRoom's projectId
        const messages = await Message.find({ roomId: chatRoom._id } as any)
            .sort({ createdAt: 1 }) // Keep the sort order
            .populate('senderId', 'name email'); // Correctly query Message model

        // Map for mobile compatibility: add 'sender' field
        const mobileCompatibleMessages = messages.map(msg => ({
            ...msg.toObject(),
            sender: msg.senderId ? (msg.senderId as any)._id.toString() : null,
            id: msg._id.toString()
        }));

        res.json(mobileCompatibleMessages);
    } catch (error) {
        console.error("❌ [HISTORY] Internal Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ============================================
// 📊 GET UNREAD MESSAGE COUNT FOR USER
// ============================================
import { getUnreadCount, getProjectUnreadCounts } from '../services/chat.service';

export const getUnreadMessageCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId as string;

        if (!userId) {
            res.status(400).json({ error: 'User ID is required' });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ error: 'Invalid user ID format' });
            return;
        }

        const count = await getUnreadCount(userId);

        res.json({ success: true, unreadCount: count });
    } catch (error) {
        console.error("❌ [UNREAD] Internal Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getProjectUnreadCountsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId as string;

        if (!userId) {
            res.status(400).json({ error: 'User ID is required' });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ error: 'Invalid user ID format' });
            return;
        }

        const counts = await getProjectUnreadCounts(userId);

        res.json({ success: true, counts });
    } catch (error) {
        console.error("❌ [PROJECT_UNREAD] Internal Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
