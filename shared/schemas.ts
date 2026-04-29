import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  companyName: z.string().optional(),
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
