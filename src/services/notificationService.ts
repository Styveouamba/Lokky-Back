import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import AdminNotification from '../models/adminNotificationModel';
import mongoose from 'mongoose';

const expo = new Expo();

export const sendPushNotification = async (
  pushToken: string,
  title: string,
  body: string,
  data?: any
): Promise<void> => {

  
  // Vérifier que le token est valide
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  // Créer le message
  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

export const sendMessageNotification = async (
  pushToken: string,
  senderName: string,
  messageContent: string,
  conversationId: string
): Promise<void> => {
  await sendPushNotification(
    pushToken,
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
  pushToken: string,
  reason: string,
  userId?: string | mongoose.Types.ObjectId
): Promise<void> => {
  // Créer la notification in-app
  if (userId) {
    await AdminNotification.create({
      user: userId,
      type: 'warning',
      title: '⚠️ Avertissement',
      message: `Vous avez reçu un avertissement : ${reason}`,
      reason,
    });
  }

  // Envoyer la notification push seulement si le token existe
  if (pushToken && Expo.isExpoPushToken(pushToken)) {
    await sendPushNotification(
      pushToken,
      '⚠️ Avertissement',
      `Vous avez reçu un avertissement : ${reason}`,
      {
        type: 'admin_warning',
        reason,
      }
    );
  }
};

// Notification de suspension
export const sendSuspensionNotification = async (
  pushToken: string,
  reason: string,
  duration: string,
  userId?: string | mongoose.Types.ObjectId
): Promise<void> => {
  // Créer la notification in-app
  if (userId) {
    await AdminNotification.create({
      user: userId,
      type: 'suspension',
      title: '🚫 Compte suspendu',
      message: `Votre compte a été suspendu pour ${duration}. Raison : ${reason}`,
      reason,
      duration,
    });
  }

  // Envoyer la notification push seulement si le token existe
  if (pushToken && Expo.isExpoPushToken(pushToken)) {
    await sendPushNotification(
      pushToken,
      '🚫 Compte suspendu',
      `Votre compte a été suspendu pour ${duration}. Raison : ${reason}`,
      {
        type: 'suspension',
        reason,
        duration,
      }
    );
  }
};

// Notification de bannissement
export const sendBanNotification = async (
  pushToken: string,
  reason: string,
  userId?: string | mongoose.Types.ObjectId
): Promise<void> => {
  // Créer la notification in-app
  if (userId) {
    await AdminNotification.create({
      user: userId,
      type: 'ban',
      title: '❌ Compte banni',
      message: `Votre compte a été banni définitivement. Raison : ${reason}`,
      reason,
    });
  }

  // Envoyer la notification push seulement si le token existe
  if (pushToken && Expo.isExpoPushToken(pushToken)) {
    await sendPushNotification(
      pushToken,
      '❌ Compte banni',
      `Votre compte a été banni définitivement. Raison : ${reason}`,
      {
        type: 'ban',
        reason,
      }
    );
  }
};

// Notification de réactivation
export const sendReactivationNotification = async (
  pushToken: string,
  userId?: string | mongoose.Types.ObjectId
): Promise<void> => {
  // Créer la notification in-app
  if (userId) {
    await AdminNotification.create({
      user: userId,
      type: 'reactivation',
      title: '✅ Compte réactivé',
      message: 'Votre compte a été réactivé. Vous pouvez à nouveau utiliser l\'application.',
    });
  }

  // Envoyer la notification push seulement si le token existe
  if (pushToken && Expo.isExpoPushToken(pushToken)) {
    await sendPushNotification(
      pushToken,
      '✅ Compte réactivé',
      'Votre compte a été réactivé. Vous pouvez à nouveau utiliser l\'application.',
      {
        type: 'reactivation',
      }
    );
  }
};

// Notification personnalisée de l'admin
export const sendCustomAdminNotification = async (
  pushToken: string,
  title: string,
  message: string,
  userId?: string | mongoose.Types.ObjectId
): Promise<void> => {
  // Créer la notification in-app
  if (userId) {
    await AdminNotification.create({
      user: userId,
      type: 'custom',
      title,
      message,
    });
  }

  // Envoyer la notification push seulement si le token existe
  if (pushToken && Expo.isExpoPushToken(pushToken)) {
    await sendPushNotification(
      pushToken,
      title,
      message,
      {
        type: 'admin_custom',
      }
    );
  }
};
