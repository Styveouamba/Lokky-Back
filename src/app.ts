import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import userRoutes from './routes/userRoutes';
import activityRoutes from './routes/activityRoutes';
import groupRoutes from './routes/groupRoutes';
import matchRoutes from './routes/matchRoutes';
import messageRoutes from './routes/messageRoutes';
import migrationRoutes from './routes/migrationRoutes';
import reviewRoutes from './routes/reviewRoutes';
import moderationRoutes from './routes/moderationRoutes';
import adminRoutes from './routes/adminRoutes';
import achievementRoutes from './routes/achievementRoutes';
import appRoutes from './routes/appRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import webhookRoutes from './routes/webhookRoutes';
import subscriptionRedirectRoutes from './routes/subscriptionRedirectRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Middleware de logging pour toutes les requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', {
    authorization: req.headers.authorization ? 'Bearer ***' : 'none',
    'content-type': req.headers['content-type'],
  });
  next();
});

// Middlewares globaux
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173', // Admin local
    'http://localhost:3000', // Landing page local
    'https://lokky.akylian.com', // Landing page production
    'https://lokky-back-teff.onrender.com', // Backend production (pour les requêtes internes)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques pour les App Links / Universal Links
app.use('/.well-known', express.static('public/.well-known'));

// Routes
app.use('/api/webhooks', webhookRoutes); // Register webhooks before body parser
app.use('/subscription', subscriptionRedirectRoutes); // Subscription redirect pages
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/migration', migrationRoutes); // Route temporaire pour la migration
app.use('/api/reviews', reviewRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/app', appRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

export default app;
