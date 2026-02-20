import { Response } from 'express';
import Group from '../models/groupModel';
import Message from '../models/messageModel';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

export const createGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await Group.create({
      ...req.body,
      createdBy: req.userId,
      members: [req.userId],
      admins: [req.userId],
    });

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du groupe' });
  }
};

export const getGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('createdBy', 'name avatar')
      .populate('members', 'name avatar');


    // Pour chaque groupe, récupérer le dernier message
    const groupsWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        
        const lastMessage = await Message.findOne({
          group: group._id,
          deletedFor: { $ne: req.userId },
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'name');


        // Compter les messages non lus
        const unreadCount = await Message.countDocuments({
          group: group._id,
          sender: { $ne: req.userId },
          read: false,
          deletedFor: { $ne: req.userId },
        });


        return {
          ...group.toObject(),
          lastMessage: lastMessage?.content || null,
          lastMessageAt: lastMessage?.createdAt || group.createdAt,
          lastMessageSender: lastMessage?.sender ? (lastMessage.sender as any).name : null,
          unreadCount,
        };
      })
    );

    res.json(groupsWithLastMessage);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des groupes' });
  }
};

export const getGroupById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name avatar')
      .populate('members', 'name avatar')
      .populate('admins', 'name avatar');

    if (!group) {
      res.status(404).json({ message: 'Groupe non trouvé' });
      return;
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du groupe' });
  }
};

export const getGroupMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { limit = 20, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      res.status(400).json({ message: 'ID de groupe invalide' });
      return;
    }

    // Vérifier que l'utilisateur est membre du groupe
    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404).json({ message: 'Groupe non trouvé' });
      return;
    }

    if (!group.members.includes(req.userId as any)) {
      res.status(403).json({ message: 'Vous n\'êtes pas membre de ce groupe' });
      return;
    }

    const query: any = {
      group: groupId,
      deletedFor: { $ne: req.userId },
    };

    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'name avatar');

    const sortedMessages = messages.reverse();

    // Vérifier s'il y a plus de messages
    const hasMore = messages.length === Number(limit);

    res.json({ messages: sortedMessages, hasMore });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des messages' });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      res.status(400).json({ message: 'ID de groupe invalide' });
      return;
    }

    const group = await Group.findById(groupId);
    if (!group) {
      res.status(404).json({ message: 'Groupe non trouvé' });
      return;
    }

    // Vérifier que l'utilisateur est membre du groupe
    if (!group.members.includes(req.userId as any)) {
      res.status(400).json({ message: 'Vous n\'êtes pas membre de ce groupe' });
      return;
    }

    // Récupérer les infos de l'utilisateur pour le message système
    const User = (await import('../models/userModel')).default;
    const user = await User.findById(req.userId).select('name avatar');

    // Vérifier si ce groupe est lié à une activité
    const Activity = (await import('../models/activityModel')).default;
    const activity = await Activity.findOne({ groupId: group._id });

    // Si le groupe est lié à une activité, retirer l'utilisateur de l'activité aussi
    if (activity) {
      // Vérifier que l'utilisateur n'est pas le créateur de l'activité
      if (activity.createdBy.toString() === req.userId) {
        res.status(400).json({ message: 'Le créateur ne peut pas quitter l\'activité' });
        return;
      }

      // Retirer l'utilisateur de l'activité
      activity.participants = activity.participants.filter(
        p => p.toString() !== req.userId
      );
      await activity.save();
    }

    // Retirer l'utilisateur du groupe
    group.members = group.members.filter(id => id.toString() !== req.userId);
    
    // Si c'était un admin, le retirer aussi des admins
    if (group.admins.includes(req.userId as any)) {
      group.admins = group.admins.filter(id => id.toString() !== req.userId);
    }

    await group.save();

    // Créer un message système pour notifier les membres restants
    const systemMessage = await Message.create({
      group: group._id,
      sender: req.userId,
      content: activity 
        ? `${user?.name} a quitté l'activité`
        : `${user?.name} a quitté le groupe`,
      isSystemMessage: true,
      systemMessageType: 'user_left',
      read: false,
    });

    const populatedMessage = await Message.findById(systemMessage._id)
      .populate('sender', 'name avatar');

    // Émettre le message via Socket.IO
    const { getIO } = await import('../socket/socketHandler');
    const io = getIO();
    io.to(group._id.toString()).emit('new_message', populatedMessage);

    // Mettre à jour le lastMessage du groupe
    group.lastMessage = systemMessage.content;
    group.lastMessageAt = systemMessage.createdAt;
    group.lastMessageSender = user?.name;
    await group.save();

    res.json({ 
      message: activity 
        ? 'Vous avez quitté l\'activité' 
        : 'Vous avez quitté le groupe' 
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Erreur lors de la sortie du groupe' });
  }
};

