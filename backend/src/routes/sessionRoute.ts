import { Router } from 'express';
import { createSession, getSessions, joinSession, endSession } from '../controllers/sessionController';
import { requireAuth } from '../middleware/authMiddleware';
import { checkBalance } from '../middleware/balanceCheck';

const router = Router();

router.post('/', requireAuth, checkBalance, createSession);
router.get('/', requireAuth, getSessions);
router.post('/:id/join', requireAuth, joinSession);
router.post('/:id/end', requireAuth, endSession);

export default router;
