import { Router, RequestHandler } from 'express';
import {
  createEvent,
  getEvents,
  getEventById,
  publishEvent,
  createTicketCheckout,
  startEvent,
  joinEvent,
  endEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createEventSchema, updateEventSchema } from '../../../shared/schemas';

const router = Router();

// Host creates event
router.post(
  '/',
  requireAuth as RequestHandler,
  validateRequest(createEventSchema) as RequestHandler,
  createEvent as unknown as RequestHandler
);

// List events (public discovery or host events)
router.get('/', optionalAuth as RequestHandler, getEvents as unknown as RequestHandler);

// Single event details & buyer ticket status
router.get('/:id', optionalAuth as RequestHandler, getEventById as unknown as RequestHandler);

// Host updates event
router.put(
  '/:id',
  requireAuth as RequestHandler,
  validateRequest(updateEventSchema) as RequestHandler,
  updateEvent as unknown as RequestHandler
);

// Host deletes/cancels event
router.delete('/:id', requireAuth as RequestHandler, deleteEvent as unknown as RequestHandler);

// Host publishes event
router.patch('/:id/publish', requireAuth as RequestHandler, publishEvent as unknown as RequestHandler);

// Buyer buys ticket
router.post('/:id/checkout', requireAuth as RequestHandler, createTicketCheckout as unknown as RequestHandler);

// Host starts live stream
router.post('/:id/start', requireAuth as RequestHandler, startEvent as unknown as RequestHandler);

// User joins live stream (entitlement gated)
router.post('/:id/join', requireAuth as RequestHandler, joinEvent as unknown as RequestHandler);

// Host ends live stream
router.post('/:id/end', requireAuth as RequestHandler, endEvent as unknown as RequestHandler);

export default router;
