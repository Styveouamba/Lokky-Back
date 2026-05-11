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
    const authHeader = req.headers.authorization;
    
    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'Token manquant' });
      return;
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET as string
    ) as { userId: string };
    
    req.userId = decoded.userId;
    
    next();
  } catch (error: any) {
    res.status(401).json({ message: 'Token invalide' });
  }
};
