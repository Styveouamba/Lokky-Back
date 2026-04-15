import { Router } from 'express';
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  markAsRead,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  deleteConversation,
  getUnreadCounts,
} from '../controllers/messageController';
import { authMiddleware } from '../middleware/authMiddleware';
import { checkModerationStatus } from '../middleware/rateLimitMiddleware';

const router = Router();

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);
router.use(checkModerationStatus);

// Récupérer toutes les conversations
router.get('/conversations', getConversations);

// Récupérer les compteurs de messages non lus
router.get('/unread-counts', getUnreadCounts);

// Créer ou récupérer une conversation avec un utilisateur
router.get('/conversations/:userId', getOrCreateConversation);

// Récupérer les messages d'une conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Marquer les messages comme lus
router.patch('/conversations/:conversationId/read', markAsRead);

// Supprimer une conversation
router.delete('/conversations/:conversationId', deleteConversation);

// Modifier un message
router.patch('/messages/:messageId', editMessage);

// Supprimer un message pour moi
router.delete('/messages/:messageId/for-me', deleteMessageForMe);

// Supprimer un message pour tout le monde
router.delete('/messages/:messageId/for-everyone', deleteMessageForEveryone);

export default router;
