import { Router } from 'express';
import { createGroup, getGroups, getGroupById, leaveGroup, updateGroupAvatar, removeMember } from '../controllers/groupController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createGroup);
router.get('/', getGroups);
router.get('/:id', getGroupById);
router.post('/:groupId/leave', leaveGroup);
router.patch('/:groupId/avatar', updateGroupAvatar);
router.delete('/:groupId/members/:memberId', removeMember);

export default router;
