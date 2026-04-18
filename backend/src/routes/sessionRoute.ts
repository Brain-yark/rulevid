import { Router } from 'express';
import { createSession, getSessions, joinSession } from '../controllers/sessionController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/', requireAuth, createSession);
router.get('/', requireAuth, getSessions);
router.post('/:id/join', requireAuth, joinSession);

export default router;
