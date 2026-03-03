import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { logger } from './utils/logger';
import { setupSocketHandlers } from './socket/socketHandler';
import { createIndexes } from './utils/createIndexes';
import { startScheduler } from './utils/scheduler';
import { cacheService } from './services/cacheService';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokky';

// Créer le serveur HTTP
const httpServer = createServer(app);

// Configurer Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // À ajuster en production
    methods: ['GET', 'POST'],
  },
});

// Setup des handlers Socket.IO
setupSocketHandlers(io);

// Connexion MongoDB et Redis
async function startServer() {
  try {
    // Connexion MongoDB
    await mongoose.connect(MONGODB_URI);
    logger.info('✅ Connecté à MongoDB');
    
    // Connexion Redis (optionnel, ne bloque pas le démarrage)
    try {
      await cacheService.connect();
      if (cacheService.isAvailable()) {
        logger.info('✅ Connecté à Redis');
      } else {
        logger.warn('⚠️  Redis non disponible - fonctionnement sans cache');
      }
    } catch (error) {
      logger.warn('⚠️  Redis non disponible - fonctionnement sans cache');
    }
    
    // Créer les index
    try {
      await createIndexes();
      logger.info('✅ Index créés avec succès');
    } catch (error) {
      logger.error('⚠️  Erreur lors de la création des index:', error);
    }
    
    // Démarrage du serveur
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
      logger.info(`🔌 Socket.IO prêt`);
      
      // Démarrer le scheduler pour les tâches planifiées
      startScheduler();
      logger.info('⏰ Scheduler démarré');
    });
  } catch (error) {
    logger.error('❌ Erreur de démarrage:', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  logger.info('SIGTERM reçu, arrêt propre...');
  await cacheService.disconnect();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT reçu, arrêt propre...');
  await cacheService.disconnect();
  await mongoose.disconnect();
  process.exit(0);
});

startServer();
