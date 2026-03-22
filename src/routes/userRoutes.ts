import { Router } from 'express';
import multer from 'multer';
import { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  uploadAvatar, 
  uploadAvatarBase64, 
  updatePushToken, 
  testPushNotification,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Configuration multer pour l'upload
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfile);
router.post('/upload-avatar', authMiddleware, upload.single('image'), uploadAvatar);
router.post('/upload-avatar-base64', authMiddleware, uploadAvatarBase64);
router.patch('/push-token', authMiddleware, updatePushToken);
router.post('/test-notification', authMiddleware, testPushNotification);

// Routes de blocage
router.get('/blocked', authMiddleware, getBlockedUsers);
router.post('/block/:userId', authMiddleware, blockUser);
router.delete('/unblock/:userId', authMiddleware, unblockUser);

export default router;
