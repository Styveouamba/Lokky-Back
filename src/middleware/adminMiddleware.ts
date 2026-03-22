import { Request, Response, NextFunction } from 'express';
import User from '../models/userModel';
import { AuthRequest } from './authMiddleware';

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('[AdminMiddleware] Checking admin role...');
    console.log('[AdminMiddleware] userId from authMiddleware:', req.userId);
    
    const userId = req.userId;

    if (!userId) {
      console.log('[AdminMiddleware] ❌ No userId found');
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const user = await User.findById(userId);

    if (!user) {
      console.log('[AdminMiddleware] ❌ User not found:', userId);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log('[AdminMiddleware] User found:', { id: user._id, role: user.role });

    if (user.role !== 'admin') {
      console.log('[AdminMiddleware] ❌ User is not admin:', user.role);
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }

    console.log('[AdminMiddleware] ✅ User is admin, access granted');
    next();
  } catch (error) {
    console.error('[AdminMiddleware] ❌ Error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
