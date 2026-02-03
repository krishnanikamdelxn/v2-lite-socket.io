
import { Request, Response } from 'express';
import Project from '../models/Project';
import ChatRoom from '../models/ChatRoom';
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

        // 2. Get Room ID (This will also check permissions/create room if needed, 
        //    although for a pure GET we might just want to find it. 
        //    But for consistency, we reuse the service logical mostly for finding).

        // Actually, for REST fetch, just finding the room is safer/faster
        const chatRoom = await ChatRoom.findOne({ projectId }).populate('messages.sender', 'name email');

        if (!chatRoom) {
            // Return empty history if room doesn't exist yet
            res.json([]);
            return;
        }

        res.json(chatRoom.messages);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
