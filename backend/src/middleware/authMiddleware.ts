import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: UserRole };
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.role) {
      return res.status(401).json({ error: 'Unauthorized: User role not found' });
    }

    // Super admin or admin has universal access
    if (user.role === 'admin' || user.role === 'super_admin' || allowedRoles.includes(user.role)) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      currentRole: user.role,
    });
  };
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: UserRole };
      (req as any).user = decoded;
    } catch {
      // Ignore invalid token on optional routes
    }
  }

  next();
};

