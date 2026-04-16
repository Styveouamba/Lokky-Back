import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/messageModel';
import Conversation from '../models/conversationModel';
import Group from '../models/groupModel';
import User from '../models/userModel';
import { sendMessageNotification } from '../services/notificationService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let io: Server;

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const setupSocketHandlers = (ioInstance: Server) => {
  io = ioInstance;
  // Middleware d'authentification Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
        userId: string;
      };
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket] User ${socket.userId} connected`);

    // Rejoindre la room personnelle de l'utilisateur pour les notifications de modération
    if (socket.userId) {
      socket.join(socket.userId);
      console.log(`[Socket] User ${socket.userId} joined personal room`);
    }

    // Rejoindre les rooms des conversations de l'utilisateur
    socket.on('join_conversation', async (conversationId: string) => {
      try {
        // Vérifier que l'utilisateur fait partie de la conversation ou du groupe
        const conversation = await Conversation.findById(conversationId);
        const group = await Group.findById(conversationId);
        
        const hasAccess = 
          (conversation && conversation.participants.some((id) => id.toString() === socket.userId)) ||
          (group && group.members.some((id) => id.toString() === socket.userId));
        
        if (hasAccess) {
          socket.join(conversationId);
        } else {
          console.log(`User ${socket.userId} denied access to ${conversationId}`);
        }
      } catch (error) {
        console.error('Join conversation error:', error);
      }
    });

    // Quitter une conversation
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
    });

    // Envoyer un message
    socket.on('send_message', async (data: { conversationId: string; content: string }) => {
      try {
        const { conversationId, content } = data;

        // Valider que le contenu n'est pas vide
        if (!content || !content.trim()) {
          socket.emit('error', { message: 'Le message ne peut pas être vide' });
          return;
        }

        // Rate limiting pour les messages
        const user = await User.findById(socket.userId);
        if (user) {
          const now = new Date();
          const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

          // Réinitialiser le compteur si la dernière minute est passée
          if (!user.rateLimit?.lastMessageSent || 
              new Date(user.rateLimit.lastMessageSent) < oneMinuteAgo) {
            user.rateLimit = {
              lastActivityCreated: user.rateLimit?.lastActivityCreated,
              activitiesCreatedToday: user.rateLimit?.activitiesCreatedToday || 0,
              messagesLastMinute: 0,
              lastMessageSent: now,
            };
          }

          // Vérifier la limite (30 messages par minute)
          const MAX_MESSAGES_PER_MINUTE = 30;
          if ((user.rateLimit?.messagesLastMinute || 0) >= MAX_MESSAGES_PER_MINUTE) {
            socket.emit('error', { message: 'Vous envoyez trop de messages. Veuillez ralentir.' });
            return;
          }

          // Incrémenter le compteur
          user.rateLimit = {
            lastActivityCreated: user.rateLimit?.lastActivityCreated,
            activitiesCreatedToday: user.rateLimit?.activitiesCreatedToday || 0,
            messagesLastMinute: (user.rateLimit?.messagesLastMinute || 0) + 1,
            lastMessageSent: now,
          };
          await user.save();
        }

        // Vérifier que l'utilisateur fait partie de la conversation ou du groupe
        const conversation = await Conversation.findById(conversationId);
        const group = await Group.findById(conversationId);

        const hasAccess = 
          (conversation && conversation.participants.some((id) => id.toString() === socket.userId)) ||
          (group && group.members.some((id) => id.toString() === socket.userId));

        if (!hasAccess) {
          socket.emit('error', { message: 'Accès non autorisé' });
          return;
        }

        // Vérifier si les utilisateurs sont bloqués (pour les conversations 1-à-1)
        if (conversation) {
          const { areUsersBlocked } = await import('../controllers/moderationController');
          const otherUserId = conversation.participants.find(
            (id) => id.toString() !== socket.userId
          );
          
          if (otherUserId) {
            const blocked = await areUsersBlocked(socket.userId!, otherUserId.toString());
            if (blocked) {
              socket.emit('error', { message: 'Vous ne pouvez pas envoyer de messages à cet utilisateur' });
              return;
            }
          }
        }

        // Créer le message
        const messageData: any = {
          sender: socket.userId,
          content: content.trim(),
        };

        // Ajouter conversation ou group selon le cas
        if (conversation) {
          messageData.conversation = conversationId;
        } else {
          messageData.group = conversationId;
        }

        const message = await Message.create(messageData);

        // Peupler les infos du sender
        await message.populate('sender', 'name avatar');

        // Vérifier et attribuer les achievements pour le premier message
        const { checkMessageAchievements } = await import('../services/achievementService');
        const achievements = await checkMessageAchievements(socket.userId!);
        
        // Si des achievements ont été débloqués, les envoyer au client
        if (achievements.length > 0) {
          socket.emit('new_achievements', achievements);
        }

        // Mettre à jour la conversation (seulement pour les conversations 1-à-1)
        if (conversation) {
          await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: content.trim(),
            lastMessageAt: new Date(),
          });
        }

        // Convertir en objet simple pour s'assurer que tous les champs sont envoyés
        const messageObject = message.toObject();

        // Envoyer le message à tous les participants
        io.to(conversationId).emit('new_message', messageObject);

        // Envoyer une notification push
        if (conversation) {
          // Notification pour conversation 1-à-1
          const recipientId = conversation.participants.find(
            (id) => id.toString() !== socket.userId
          );

          if (recipientId) {
            // Vérifier si le destinataire est connecté et dans la conversation
            const recipientSockets = await io.in(conversationId).fetchSockets();
            const isRecipientInConversation = recipientSockets.some(
              (s: any) => s.userId === recipientId.toString()
            );

            // Envoyer la notification seulement si le destinataire n'est PAS dans la conversation
            if (!isRecipientInConversation) {
              const sender = await User.findById(socket.userId);
              
              if (sender) {
                console.log(`[Socket] Sending push notification to user ${recipientId}`);
                await sendMessageNotification(
                  recipientId,
                  sender.name,
                  content.trim(),
                  conversationId
                );
              }
            } else {
              console.log('[Socket] Recipient is in conversation, skipping notification');
            }
          }
        } else if (group) {
          // Notification pour groupe
          const sender = await User.findById(socket.userId);
          
          if (sender) {
            // Récupérer tous les membres du groupe sauf l'expéditeur
            const groupMembers = group.members.filter(
              (memberId) => memberId.toString() !== socket.userId
            );

            // Récupérer les sockets connectés dans ce groupe
            const connectedSockets = await io.in(conversationId).fetchSockets();
            const connectedUserIds = connectedSockets.map((s: any) => s.userId);

            // Envoyer une notification à chaque membre qui n'est PAS dans la conversation
            for (const memberId of groupMembers) {
              const memberIdString = memberId.toString();
              
              // Ne pas envoyer si le membre est actuellement dans la conversation
              if (!connectedUserIds.includes(memberIdString)) {
                console.log(`[Socket] Sending group push notification to user ${memberIdString}`);
                
                // Format du message : "[Nom du groupe] Nom: Message"
                const notificationTitle = group.name || 'Groupe';
                const notificationBody = `${sender.name}: ${content.trim()}`;
                
                await sendMessageNotification(
                  memberId,
                  notificationTitle,
                  notificationBody,
                  conversationId
                );
              }
            }
          }
        }

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.userId,
        isTyping: data.isTyping,
      });
    });

    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
};
