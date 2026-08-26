import { Router, RequestHandler } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/authController';
import rateLimit from 'express-rate-limit';
import { validateRequest } from '../middleware/validateRequest';
import { requireAuth } from '../middleware/authMiddleware';
import { registerSchema, loginSchema } from '@shared/schemas';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const router = Router();

router.post('/register', authLimiter as RequestHandler, validateRequest(registerSchema) as RequestHandler, register as unknown as RequestHandler);
router.post('/login', authLimiter as RequestHandler, validateRequest(loginSchema) as RequestHandler, login as unknown as RequestHandler);
router.get('/me', getMe as unknown as RequestHandler);
router.put('/profile', requireAuth as RequestHandler, updateProfile as unknown as RequestHandler);
router.put('/me', requireAuth as RequestHandler, updateProfile as unknown as RequestHandler);

export default router;
