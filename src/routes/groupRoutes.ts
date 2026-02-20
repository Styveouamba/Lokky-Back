import { Router } from 'express';
import { createGroup, getGroups, getGroupById, leaveGroup } from '../controllers/groupController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createGroup);
router.get('/', getGroups);
router.get('/:id', getGroupById);
router.post('/:groupId/leave', leaveGroup);

export default router;
