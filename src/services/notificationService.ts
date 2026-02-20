import { Expo, ExpoPushMessage } from 'expo-server-sdk';

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
