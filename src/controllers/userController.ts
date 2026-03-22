import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import fs from 'fs';
import User from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadImage } from '../utils/cloudinary';

const generateToken = (userId: any): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const signOptions: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
  };

  return jwt.sign({ userId }, jwtSecret, signOptions);
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email déjà utilisé' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      authProvider: 'email',
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        interests: user.interests,
        goals: user.goals,
        location: user.location,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.authProvider !== 'email') {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        interests: user.interests,
        goals: user.goals,
        location: user.location,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {


    const { name, avatar, interests, goals, location } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (interests !== undefined) updateData.interests = interests; // Permet les tableaux vides
    if (goals !== undefined) updateData.goals = goals; // Permet les tableaux vides
    if (location && location.coordinates && location.coordinates.length === 2) {
      updateData.location = {
        type: 'Point',
        coordinates: location.coordinates,
      };
    }


    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    
    if (!req.file) {
      console.error('No file in request');
      res.status(400).json({ message: 'Aucune image fournie' });
      return;
    }


    // Upload vers Cloudinary
    const result = await uploadImage(req.file.path);
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }
    
    // Mettre à jour l'avatar de l'utilisateur
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: result },
      { new: true }
    ).select('-password');

    if (!user) {
      console.error('User not found:', req.userId);
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ avatarUrl: result, user });
  } catch (error: any) {
    // Supprimer le fichier temporaire en cas d'erreur
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting temporary file after error:', unlinkError);
      }
    }
    
    console.error('Upload avatar error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: error.message 
    });
  }
};

// Upload avatar avec base64
export const uploadAvatarBase64 = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    
    const { image, mimeType } = req.body;
    
    if (!image) {
      console.error('No image data in request');
      res.status(400).json({ message: 'Aucune image fournie' });
      return;
    }

    // Créer un fichier temporaire
    const tempFilePath = `./uploads/temp-${Date.now()}.jpg`;
    const buffer = Buffer.from(image, 'base64');
    fs.writeFileSync(tempFilePath, buffer);


    // Upload vers Cloudinary
    const result = await uploadImage(tempFilePath);
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(tempFilePath);
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }
    
    // Mettre à jour l'avatar de l'utilisateur
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: result },
      { new: true }
    ).select('-password');

    if (!user) {
      console.error('User not found:', req.userId);
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    res.json({ avatarUrl: result, user });
  } catch (error: any) {
    console.error('Upload avatar base64 error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: error.message 
    });
  }
};

// Mettre à jour le push token
export const updatePushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pushToken } = req.body;

    // Accepter null pour supprimer le token
    if (pushToken === undefined) {
      res.status(400).json({ message: 'Push token requis' });
      return;
    }


    const user = await User.findByIdAndUpdate(
      req.userId,
      { pushToken: pushToken || undefined },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }


    res.json({ 
      message: pushToken ? 'Push token mis à jour' : 'Push token supprimé', 
      user 
    });
  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du push token' });
  }
};

// Endpoint de test pour envoyer une notification
export const testPushNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    if (!user.pushToken) {
      res.status(400).json({ message: 'Aucun push token enregistré pour cet utilisateur' });
      return;
    }


    // Importer le service de notification
    const { sendPushNotification } = await import('../services/notificationService');
    
    await sendPushNotification(
      user.pushToken,
      'Test de notification 🔔',
      'Si tu reçois ce message, les notifications fonctionnent !',
      { test: true }
    );

    res.json({ 
      message: 'Notification de test envoyée',
      pushToken: user.pushToken
    });
  } catch (error) {
    console.error('Test push notification error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de la notification de test' });
  }
};

// Bloquer un utilisateur
export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { userId: blockedUserId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    if (!blockedUserId) {
      res.status(400).json({ message: 'ID utilisateur manquant' });
      return;
    }

    // Vérifier qu'on ne se bloque pas soi-même
    if (userId === blockedUserId) {
      res.status(400).json({ message: 'Vous ne pouvez pas vous bloquer vous-même' });
      return;
    }

    // Vérifier que l'utilisateur à bloquer existe
    const userToBlock = await User.findById(blockedUserId);
    if (!userToBlock) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Importer le modèle Block
    const Block = (await import('../models/blockModel')).default;

    // Vérifier si le blocage existe déjà
    const existingBlock = await Block.findOne({
      blocker: userId,
      blocked: blockedUserId,
    });

    if (existingBlock) {
      res.status(400).json({ message: 'Utilisateur déjà bloqué' });
      return;
    }

    // Créer le blocage
    const block = await Block.create({
      blocker: userId,
      blocked: blockedUserId,
    });

    // Peupler les données pour la réponse
    const populatedBlock = await Block.findById(block._id)
      .populate('blocker', 'name avatar')
      .populate('blocked', 'name avatar');

    res.status(201).json(populatedBlock);
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Erreur lors du blocage' });
  }
};

// Débloquer un utilisateur
export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { userId: blockedUserId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    if (!blockedUserId) {
      res.status(400).json({ message: 'ID utilisateur manquant' });
      return;
    }

    // Importer le modèle Block
    const Block = (await import('../models/blockModel')).default;

    // Trouver et supprimer le blocage
    const block = await Block.findOneAndDelete({
      blocker: userId,
      blocked: blockedUserId,
    });

    if (!block) {
      res.status(404).json({ message: 'Blocage non trouvé' });
      return;
    }

    res.json({ message: 'Utilisateur débloqué avec succès' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Erreur lors du déblocage' });
  }
};

// Récupérer la liste des utilisateurs bloqués
export const getBlockedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    // Importer le modèle Block
    const Block = (await import('../models/blockModel')).default;

    // Récupérer tous les blocages de l'utilisateur
    const blocks = await Block.find({ blocker: userId })
      .populate('blocked', 'name avatar email')
      .sort({ createdAt: -1 });

    res.json(blocks);
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs bloqués' });
  }
};
