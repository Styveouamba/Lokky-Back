import AdminNotification from '../models/adminNotificationModel';
import User from '../models/userModel';
import mongoose from 'mongoose';

/**
 * Vérifie si un token est un token Expo valide
 */
const isExpoPushToken = (token: string): boolean => {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
  );
};

/**
 * Supprime le push token d'un utilisateur s'il est invalide
 */
const removeInvalidPushToken = async (userId: string | mongoose.Types.ObjectId): Promise<void> => {
  try {
    await User.findByIdAndUpdate(userId, { $unset: { pushToken: "" } });
    console.log(`Removed invalid push token for user ${userId}`);
  } catch (error) {
    console.error(`Error removing push token for user ${userId}:`, error);
  }
};

/**
 * Récupère le push token d'un utilisateur depuis la base de données
 * Retourne null si l'utilisateur n'a pas de token ou si le token est invalide
 */
const getUserPushToken = async (userId: string | mongoose.Types.ObjectId): Promise<string | null> => {
  try {
    const user = await User.findById(userId).select('pushToken');
    
    if (!user || !user.pushToken) {
      return null;
    }

    // Vérifier que le token est valide
    if (!isExpoPushToken(user.pushToken)) {
      console.warn(`Invalid push token format for user ${userId}, removing it`);
      await removeInvalidPushToken(userId);
      return null;
    }

    return user.pushToken;
  } catch (error) {
    console.error(`Error fetching push token for user ${userId}:`, error);
    return null;
  }
};

/**
 * Envoie une notification push via l'API HTTP Expo
 * Utilise l'API directe au lieu du SDK pour plus de contrôle
 */
export const sendPushNotification = async (
  pushToken: string,
  title: string,
  body: string,
  data?: any,
  userId?: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  // Vérifier que le token est valide
  if (!pushToken || !isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    if (userId) {
      await removeInvalidPushToken(userId);
    }
    return false;
  }

  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result: any = await response.json();

    if (!response.ok) {
      console.error('Error sending push notification:', result);
      
      // Si le token est invalide, le supprimer de la base de données
      if (result.data?.error === 'DeviceNotRegistered' && userId) {
        console.log(`Token ${pushToken} is no longer valid, removing from user ${userId}`);
        await removeInvalidPushToken(userId);
      }
      return false;
    }

    // Vérifier le ticket de réponse
    if (result.data && result.data.status === 'error') {
      console.error('Push notification error:', result.data.message);
      
      // Si le token n'est plus enregistré, le supprimer
      if (result.data.details?.error === 'DeviceNotRegistered' && userId) {
        console.log(`Token ${pushToken} is no longer registered, removing from user ${userId}`);
        await removeInvalidPushToken(userId);
      }
      return false;
    }

    console.log('Push notification sent successfully:', result);
    return true;

  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

/**
 * Envoie une notification push à un utilisateur en récupérant son token depuis la DB
 * Cette fonction vérifie automatiquement que l'utilisateur a un token valide
 */
export const sendPushNotificationToUser = async (
  userId: string | mongoose.Types.ObjectId,
  title: string,
  body: string,
  data?: any
): Promise<boolean> => {
  const pushToken = await getUserPushToken(userId);
  
  if (!pushToken) {
    console.log(`User ${userId} has no valid push token, skipping notification`);
    return false;
  }

  return await sendPushNotification(pushToken, title, body, data, userId);
};

export const sendMessageNotification = async (
  userId: string | mongoose.Types.ObjectId,
  senderName: string,
  messageContent: string,
  conversationId: string
): Promise<boolean> => {
  return await sendPushNotificationToUser(
    userId,
    `Nouveau message de ${senderName}`,
    messageContent,
    {
      type: 'message',
      conversationId,
    }
  );
};

// Notification d'avertissement admin
export const sendAdminWarningNotification = async (
  userId: string | mongoose.Types.ObjectId,
  reason: string
): Promise<void> => {
  // Créer la notification in-app
  await AdminNotification.create({
    user: userId,
    type: 'warning',
    title: '⚠️ Avertissement',
    message: `Vous avez reçu un avertissement : ${reason}`,
    reason,
  });

  // Envoyer la notification push (vérifie automatiquement le token)
  await sendPushNotificationToUser(
    userId,
    '⚠️ Avertissement',
    `Vous avez reçu un avertissement : ${reason}`,
    {
      type: 'admin_warning',
      reason,
    }
  );
};

// Notification de suspension
export const sendSuspensionNotification = async (
  userId: string | mongoose.Types.ObjectId,
  reason: string,
  duration: string
): Promise<void> => {
  // Créer la notification in-app
  await AdminNotification.create({
    user: userId,
    type: 'suspension',
    title: '🚫 Compte suspendu',
    message: `Votre compte a été suspendu pour ${duration}. Raison : ${reason}`,
    reason,
    duration,
  });

  // Envoyer la notification push (vérifie automatiquement le token)
  await sendPushNotificationToUser(
    userId,
    '🚫 Compte suspendu',
    `Votre compte a été suspendu pour ${duration}. Raison : ${reason}`,
    {
      type: 'suspension',
      reason,
      duration,
    }
  );
};

// Notification de bannissement
export const sendBanNotification = async (
  userId: string | mongoose.Types.ObjectId,
  reason: string
): Promise<void> => {
  // Créer la notification in-app
  await AdminNotification.create({
    user: userId,
    type: 'ban',
    title: '❌ Compte banni',
    message: `Votre compte a été banni définitivement. Raison : ${reason}`,
    reason,
  });

  // Envoyer la notification push (vérifie automatiquement le token)
  await sendPushNotificationToUser(
    userId,
    '❌ Compte banni',
    `Votre compte a été banni définitivement. Raison : ${reason}`,
    {
      type: 'ban',
      reason,
    }
  );
};

// Notification de réactivation
export const sendReactivationNotification = async (
  userId: string | mongoose.Types.ObjectId
): Promise<void> => {
  // Créer la notification in-app
  await AdminNotification.create({
    user: userId,
    type: 'reactivation',
    title: '✅ Compte réactivé',
    message: 'Votre compte a été réactivé. Vous pouvez à nouveau utiliser l\'application.',
  });

  // Envoyer la notification push (vérifie automatiquement le token)
  await sendPushNotificationToUser(
    userId,
    '✅ Compte réactivé',
    'Votre compte a été réactivé. Vous pouvez à nouveau utiliser l\'application.',
    {
      type: 'reactivation',
    }
  );
};

// Notification personnalisée de l'admin
export const sendCustomAdminNotification = async (
  userId: string | mongoose.Types.ObjectId,
  title: string,
  message: string
): Promise<void> => {
  // Créer la notification in-app
  await AdminNotification.create({
    user: userId,
    type: 'custom',
    title,
    message,
  });

  // Envoyer la notification push (vérifie automatiquement le token)
  await sendPushNotificationToUser(
    userId,
    title,
    message,
    {
      type: 'admin_custom',
    }
  );
};
