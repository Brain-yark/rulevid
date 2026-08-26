import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateRequest = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError || (error as any)?.name === 'ZodError' || Array.isArray((error as any)?.issues) || Array.isArray((error as any)?.errors)) {
        const issues = (error as any).issues || (error as any).errors || [];
        res.status(400).json({
          error: 'Validation failed',
          details: issues.map((err: any) => ({
            path: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
            message: err.message
          }))
        });
        return;
      }
      console.error('[validateRequest] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error during validation', message: (error as any)?.message });
      return;
    }
  };
};
