
import { Router } from 'express';
import { getProjectChatHistory, getUnreadMessageCount, getProjectUnreadCountsController } from '../controllers/chat.controller';

const router = Router();

// GET /api/chat/project/:projectId
router.get('/project/:projectId', getProjectChatHistory);

// GET /api/chat/unread/:userId
router.get('/unread/:userId', getUnreadMessageCount);

// GET /api/chat/unread-projects/:userId
router.get('/unread-projects/:userId', getProjectUnreadCountsController);

export default router;
