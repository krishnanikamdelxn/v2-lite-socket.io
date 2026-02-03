
import { Request, Response } from 'express';
import Project from '../models/Project';
import ChatRoom from '../models/ChatRoom';
import Message from '../models/Message';
import { getOrCreateChatRoom } from '../services/chat.service';

export const getProjectChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            res.status(400).json({ error: 'Projet ID is required' });
            return;
        }

        // 1. Verify Project Exists
        const project = await Project.findById(projectId);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        // 2. Find the ChatRoom
        const chatRoom = await ChatRoom.findOne({ projectId } as any);

        if (!chatRoom) {
            // Return empty history if room doesn't exist yet
            res.json([]);
            return;
        }

        // 3. Fetch messages for this room
        const messages = await Message.find({ roomId: chatRoom._id } as any)
            .sort({ createdAt: 1 })
            .populate('senderId', 'name email');

        // Map for mobile compatibility: add 'sender' field
        const mobileCompatibleMessages = messages.map(msg => ({
            ...msg.toObject(),
            sender: msg.senderId ? (msg.senderId as any)._id.toString() : null,
            id: msg._id.toString()
        }));

        res.json(mobileCompatibleMessages);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
