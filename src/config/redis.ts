import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Déterminer si TLS est nécessaire (Upstash utilise rediss://)
const useTLS = redisUrl.startsWith('rediss://');

export const redisClient = createClient({
  url: redisUrl,
  socket: useTLS
    ? {
        tls: true,
        rejectUnauthorized: false, // Nécessaire pour Upstash
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Too many reconnection attempts');
            return new Error('Too many reconnection attempts');
          }
          return 1000;
        },
      }
    : {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Too many reconnection attempts');
            return new Error('Too many reconnection attempts');
          }
          return 1000;
        },
      },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Ne pas bloquer l'application si Redis n'est pas disponible
    // L'app peut fonctionner sans cache
  }
};

export const disconnectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      console.log('Redis disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting Redis:', error);
  }
};
