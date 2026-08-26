import { Router, RequestHandler } from 'express';
import { createSession, getSessions, joinSession, endSession, refreshToken } from '../controllers/sessionController';
import { requireAuth } from '../middleware/authMiddleware';
import { checkBalance } from '../middleware/balanceCheck';
import { validateRequest } from '../middleware/validateRequest';
import { createSessionSchema } from '@shared/schemas';

const router = Router();

router.post('/', requireAuth as RequestHandler, checkBalance as RequestHandler, validateRequest(createSessionSchema) as RequestHandler, createSession as unknown as RequestHandler);
router.get('/', requireAuth as RequestHandler, getSessions as unknown as RequestHandler);
router.post('/:id/join', requireAuth as RequestHandler, joinSession as unknown as RequestHandler);
router.post('/:id/end', requireAuth as RequestHandler, endSession as unknown as RequestHandler);
router.post('/:id/refresh-token', requireAuth as RequestHandler, refreshToken as unknown as RequestHandler);

export default router;
