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
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Middlewares globaux
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/migration', migrationRoutes); // Route temporaire pour la migration
app.use('/api/reviews', reviewRoutes);
app.use('/api/moderation', moderationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

export default app;
