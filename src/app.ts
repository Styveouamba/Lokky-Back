import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import debugRoutes from './routes/debugRoutes';
import galleryRoutes from './routes/galleryRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

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

// Limite de taille des requêtes pour éviter les attaques par payload énorme
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting pour les routes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives max
  message: 'Trop de tentatives, réessaie dans 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting général pour toutes les API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: 'Trop de requêtes, réessaie plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});

// Servir les fichiers statiques pour les App Links / Universal Links
app.use('/.well-known', express.static('public/.well-known'));

// Routes
app.use('/api/webhooks', webhookRoutes); // Register webhooks before body parser
app.use('/subscription', subscriptionRedirectRoutes); // Subscription redirect pages

// Routes avec rate limiting pour l'authentification
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/verify-code', authLimiter);
app.use('/api/users/resend-code', authLimiter);
app.use('/api/users/forgot-password', authLimiter);

// Routes générales avec rate limiting
app.use('/api', generalLimiter);

app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/app', appRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/gallery', galleryRoutes);

// Routes sensibles - uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
  app.use('/api/migration', migrationRoutes);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

export default app;
