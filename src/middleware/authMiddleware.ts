import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[AuthMiddleware] Checking authentication...');
    const authHeader = req.headers.authorization;
    console.log('[AuthMiddleware] Authorization header:', authHeader ? 'present' : 'missing');
    
    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.log('[AuthMiddleware] ❌ Token missing');
      res.status(401).json({ message: 'Token manquant' });
      return;
    }

    console.log('[AuthMiddleware] Token found, verifying...');
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET as string
    ) as { userId: string };
    
    console.log('[AuthMiddleware] ✅ Token valid, userId:', decoded.userId);
    req.userId = decoded.userId;
    
    next();
  } catch (error: any) {
    console.log('[AuthMiddleware] ❌ Token verification failed:', error.message);
    res.status(401).json({ message: 'Token invalide' });
  }
};
