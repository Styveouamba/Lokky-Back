import { Router } from 'express';
import { getSuggestedUsers } from '../controllers/matchController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/suggestions', authMiddleware, getSuggestedUsers);

export default router;
