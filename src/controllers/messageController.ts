import { Response } from 'express';
import Conversation from '../models/conversationModel';
import Message from '../models/messageModel';
import Group from '../models/groupModel';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

// Récupérer toutes les conversations de l'utilisateur
export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
      lastMessage: { $exists: true, $ne: null }, // Filtrer les conversations sans messages
    })
      .populate('participants', 'name avatar')
      .sort({ lastMessageAt: -1 })
      .limit(50);

    // Compter les messages non lus pour chaque conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        // Compter seulement les messages non supprimés pour cet utilisateur
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: req.userId },
          read: false,
          deletedFor: { $ne: req.userId },
        });

        // Vérifier s'il y a des messages visibles pour cet utilisateur
        const visibleMessagesCount = await Message.countDocuments({
          conversation: conv._id,
          deletedFor: { $ne: req.userId },
        });

        // Ne retourner la conversation que si elle a des messages visibles
        if (visibleMessagesCount === 0) {
          return null;
        }

        return {
          ...conv.toObject(),
          unreadCount,
        };
      })
    );

    // Filtrer les conversations null (sans messages visibles)
    const filteredConversations = conversationsWithUnread.filter(conv => conv !== null);

    res.json({ conversations: filteredConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
  }
};

// Créer ou récupérer une conversation avec un utilisateur
export const getOrCreateConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: 'ID utilisateur invalide' });
      return;
    }

    if (userId === currentUserId) {
      res.status(400).json({ message: 'Impossible de créer une conversation avec soi-même' });
      return;
    }

    // Chercher une conversation existante
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId] },
    }).populate('participants', 'name avatar');

    // Si elle n'existe pas, la créer
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, userId],
      });

      conversation = await conversation.populate('participants', 'name avatar');
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la conversation' });
  }
};

// Récupérer les messages d'une conversation ou d'un groupe
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { limit = 20, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ message: 'ID conversation invalide' });
      return;
    }

    // Vérifier si c'est une conversation ou un groupe
    const conversation = await Conversation.findById(conversationId);
    const group = await Group.findById(conversationId);

    if (!conversation && !group) {
      res.status(404).json({ message: 'Conversation ou groupe non trouvé' });
      return;
    }

    // Vérifier que l'utilisateur a accès
    if (conversation) {
      if (!conversation.participants.some((id) => id.toString() === req.userId)) {
        res.status(403).json({ message: 'Accès non autorisé' });
        return;
      }
    } else if (group) {
      if (!group.members.some((id) => id.toString() === req.userId)) {
        res.status(403).json({ message: 'Accès non autorisé' });
        return;
      }
    }

    // Construire la requête
    const query: any = { 
      deletedFor: { $ne: req.userId }, // Exclure les messages supprimés pour cet utilisateur
    };

    // Ajouter le filtre conversation ou group
    if (conversation) {
      query.conversation = conversationId;
    } else {
      query.group = conversationId;
    }

    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const limitNum = Number(limit);
    
    // Récupérer un message de plus pour savoir s'il y en a d'autres
    const messages = await Message.find(query)
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limitNum + 1);


    // Vérifier s'il y a plus de messages
    const hasMore = messages.length > limitNum;
    
    
    // Retourner seulement le nombre demandé
    const messagesToReturn = hasMore ? messages.slice(0, limitNum) : messages;
    
    // Le message le plus ancien est le dernier avant le reverse (car on trie par createdAt desc)
    const oldestMessageDate = messagesToReturn.length > 0 
      ? messagesToReturn[messagesToReturn.length - 1].createdAt 
      : null;

    res.json({ 
      messages: messagesToReturn.reverse(),
      hasMore,
      oldestMessageDate
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des messages' });
  }
};

// Marquer les messages comme lus
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ message: 'ID conversation invalide' });
      return;
    }

    // Vérifier si c'est une conversation ou un groupe
    const conversation = await Conversation.findById(conversationId);
    const group = await Group.findById(conversationId);

    if (!conversation && !group) {
      res.status(404).json({ message: 'Conversation ou groupe non trouvé' });
      return;
    }

    // Vérifier que l'utilisateur a accès
    if (conversation) {
      if (!conversation.participants.some((id) => id.toString() === req.userId)) {
        res.status(403).json({ message: 'Accès non autorisé' });
        return;
      }
    } else if (group) {
      if (!group.members.some((id) => id.toString() === req.userId)) {
        res.status(403).json({ message: 'Accès non autorisé' });
        return;
      }
    }

    // Construire la requête pour marquer les messages comme lus
    const query: any = {
      sender: { $ne: req.userId },
      read: false,
    };

    if (conversation) {
      query.conversation = conversationId;
    } else {
      query.group = conversationId;
    }

    // Marquer tous les messages non lus comme lus
    await Message.updateMany(query, { read: true });

    res.json({ message: 'Messages marqués comme lus' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour' });
  }
};

// Modifier un message
export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'ID message invalide' });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Le contenu ne peut pas être vide' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: 'Message non trouvé' });
      return;
    }

    // Vérifier que c'est bien l'expéditeur
    if (message.sender.toString() !== req.userId) {
      res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres messages' });
      return;
    }

    // Vérifier que le message n'est pas supprimé pour tout le monde
    if (message.deletedForEveryone) {
      res.status(400).json({ message: 'Ce message a été supprimé' });
      return;
    }

    message.content = content.trim();
    message.edited = true;
    await message.save();

    await message.populate('sender', 'name avatar');

    res.json({ message });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Erreur lors de la modification' });
  }
};

// Supprimer un message pour moi
export const deleteMessageForMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'ID message invalide' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: 'Message non trouvé' });
      return;
    }

    // Ajouter l'utilisateur à la liste deletedFor
    if (!message.deletedFor.includes(req.userId as any)) {
      message.deletedFor.push(req.userId as any);
      await message.save();
    }

    res.json({ message: 'Message supprimé pour vous' });
  } catch (error) {
    console.error('Delete message for me error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
};

// Supprimer un message pour tout le monde
export const deleteMessageForEveryone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'ID message invalide' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: 'Message non trouvé' });
      return;
    }

    // Vérifier que c'est bien l'expéditeur
    if (message.sender.toString() !== req.userId) {
      res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres messages' });
      return;
    }

    message.deletedForEveryone = true;
    message.content = 'Ce message a été supprimé';
    await message.save();

    res.json({ message: 'Message supprimé pour tout le monde' });
  } catch (error) {
    console.error('Delete message for everyone error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
};

// Supprimer une conversation
export const deleteConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ message: 'ID conversation invalide' });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: 'Conversation non trouvée' });
      return;
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    if (!conversation.participants.some((id) => id.toString() === req.userId)) {
      res.status(403).json({ message: 'Accès non autorisé' });
      return;
    }

    // Supprimer tous les messages de la conversation pour cet utilisateur
    await Message.updateMany(
      { conversation: conversationId },
      { $addToSet: { deletedFor: req.userId } }
    );

    // Si les deux participants ont supprimé la conversation, la supprimer complètement
    const allMessages = await Message.find({ conversation: conversationId });
    const allDeleted = allMessages.every(msg => 
      conversation.participants.every(participantId => 
        msg.deletedFor.includes(participantId as any)
      )
    );

    if (allDeleted) {
      await Message.deleteMany({ conversation: conversationId });
      await Conversation.findByIdAndDelete(conversationId);
    }

    res.json({ message: 'Conversation supprimée' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
};

// Récupérer les compteurs de messages non lus pour toutes les conversations
export const getUnreadCounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Récupérer toutes les conversations de l'utilisateur
    const conversations = await Conversation.find({
      participants: req.userId,
    }).select('_id');

    // Récupérer tous les groupes de l'utilisateur
    const groups = await Group.find({
      members: req.userId,
    }).select('_id');

    // Combiner les IDs
    const allConversationIds = [
      ...conversations.map(c => c._id),
      ...groups.map(g => g._id),
    ];

    // Compter les messages non lus pour chaque conversation/groupe
    const counts = await Promise.all(
      allConversationIds.map(async (convId) => {
        // Vérifier si c'est une conversation ou un groupe
        const isConversation = conversations.some(c => c._id.equals(convId));
        
        const query: any = {
          sender: { $ne: req.userId },
          read: false,
          deletedFor: { $ne: req.userId },
        };

        if (isConversation) {
          query.conversation = convId;
        } else {
          query.group = convId;
        }

        const count = await Message.countDocuments(query);

        return {
          conversationId: convId.toString(),
          count,
        };
      })
    );

    // Filtrer pour ne retourner que ceux avec des messages non lus
    const nonZeroCounts = counts.filter(c => c.count > 0);

    res.json({ counts: nonZeroCounts });
  } catch (error) {
    console.error('Get unread counts error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des compteurs' });
  }
};
