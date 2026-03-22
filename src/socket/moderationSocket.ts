import { getIO } from './socketHandler';

// Émettre un événement de bannissement
export const emitUserBanned = (userId: string, reason: string) => {
  try {
    const io = getIO();
    io.to(userId).emit('user_banned', {
      reason,
      timestamp: new Date(),
    });
    console.log(`[Socket] Emitted user_banned to user ${userId}`);
  } catch (error) {
    console.error('Error emitting user_banned:', error);
  }
};

// Émettre un événement de suspension
export const emitUserSuspended = (userId: string, reason: string, suspendedUntil: Date) => {
  try {
    const io = getIO();
    io.to(userId).emit('user_suspended', {
      reason,
      suspendedUntil,
      timestamp: new Date(),
    });
    console.log(`[Socket] Emitted user_suspended to user ${userId}`);
  } catch (error) {
    console.error('Error emitting user_suspended:', error);
  }
};

// Émettre un événement de réactivation
export const emitUserReactivated = (userId: string) => {
  try {
    const io = getIO();
    io.to(userId).emit('user_reactivated', {
      timestamp: new Date(),
    });
    console.log(`[Socket] Emitted user_reactivated to user ${userId}`);
  } catch (error) {
    console.error('Error emitting user_reactivated:', error);
  }
};

// Émettre un événement d'avertissement
export const emitUserWarned = (userId: string, reason: string, warningCount: number) => {
  try {
    const io = getIO();
    io.to(userId).emit('user_warned', {
      reason,
      warningCount,
      timestamp: new Date(),
    });
    console.log(`[Socket] Emitted user_warned to user ${userId}`);
  } catch (error) {
    console.error('Error emitting user_warned:', error);
  }
};
