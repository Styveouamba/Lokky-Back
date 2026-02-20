import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { logger } from './utils/logger';
import { setupSocketHandlers } from './socket/socketHandler';
import { createIndexes } from './utils/createIndexes';
import { startScheduler } from './utils/scheduler';

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

// Connexion MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    logger.info('✅ Connecté à MongoDB');
    
    // Créer les index
    try {
      await createIndexes();
      logger.info('✅ Index créés avec succès');
    } catch (error) {
      logger.error('⚠️  Erreur lors de la création des index:', error);
      // Ne pas arrêter le serveur si les index échouent
    }
    
    // Démarrage du serveur
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Serveur démarré sur le port ${PORT}`);
      logger.info(`🔌 Socket.IO prêt`);
      
      // Démarrer le scheduler pour les tâches planifiées
      startScheduler();
      logger.info('⏰ Scheduler démarré');
    });
  })
  .catch((error) => {
    logger.error('❌ Erreur de connexion MongoDB:', error);
    process.exit(1);
  });
