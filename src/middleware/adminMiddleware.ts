import { Request, Response, NextFunction } from 'express';
import User from '../models/userModel';
import { AuthRequest } from './authMiddleware';

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {

    
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }


    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }

    next();
  } catch (error) {
    console.error('[AdminMiddleware] ❌ Error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
