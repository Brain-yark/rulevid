import { Router, RequestHandler } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import {
  getOverviewStats,
  getUsers,
  updateUserRole,
  updateUserStatus,
  getAllEvents,
  getAllSessions,
  getAllTransactions,
  seedSuperAdminHandler,
} from '../controllers/adminController';

const router = Router();

// Public seed endpoint for initial setup/recovery
router.post('/seed-superadmin', seedSuperAdminHandler as unknown as RequestHandler);

// All other endpoints require authentication and admin or super_admin role
router.use(requireAuth as unknown as RequestHandler);
router.use(requireRole(['admin', 'super_admin']) as unknown as RequestHandler);

router.get('/overview', getOverviewStats as unknown as RequestHandler);
router.get('/users', getUsers as unknown as RequestHandler);
router.patch('/users/:id/role', updateUserRole as unknown as RequestHandler);
router.patch('/users/:id/status', updateUserStatus as unknown as RequestHandler);
router.get('/events', getAllEvents as unknown as RequestHandler);
router.get('/sessions', getAllSessions as unknown as RequestHandler);
router.get('/transactions', getAllTransactions as unknown as RequestHandler);

export default router;
