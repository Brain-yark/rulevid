import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  role: z.enum(['user', 'host', 'moderator', 'admin', 'super_admin']).default('user'),
  companyName: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const createSessionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long').max(100, 'Title is too long'),
  description: z.string().optional(),
});

export const topupSchema = z.object({
  amount: z.number().positive('Top-up amount must be positive'),
});

export const createEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long').max(120, 'Title is too long'),
  description: z.string().optional(),
  startsAt: z.string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Valid start date and time is required' })
    .refine((val) => new Date(val) > new Date(), { message: 'Event start time must be in the future' }),
  priceCents: z.number().int().min(0, 'Price cannot be negative').default(0),
  capacity: z.number().int().positive().nullable().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long').max(120, 'Title is too long').optional(),
  description: z.string().optional(),
  startsAt: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Valid start date and time is required' })
    .refine((val) => !val || new Date(val) > new Date(), { message: 'Event start time must be in the future' })
    .optional(),
  priceCents: z.number().int().min(0, 'Price cannot be negative').optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

export const updateEventStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'cancelled']),
});

export const buyTicketSchema = z.object({
  eventId: z.string().uuid().optional(),
});
