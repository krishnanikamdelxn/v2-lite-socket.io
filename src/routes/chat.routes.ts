
import { Router } from 'express';
import { getProjectChatHistory } from '../controllers/chat.controller';

const router = Router();

// GET /api/chat/project/:projectId
router.get('/project/:projectId', getProjectChatHistory);

export default router;
