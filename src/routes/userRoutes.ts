import { Router } from 'express';
import multer from 'multer';
import { 
  register, 
  login,
  googleAuth,
  appleAuth,
  sendVerificationCode,
  verifyCode,
  sendPasswordResetCode,
  resetPassword,
  getProfile, 
  updateProfile, 
  uploadAvatar, 
  uploadAvatarBase64, 
  updatePushToken, 
  testPushNotification,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getLeaderboard,
  getUserPublicProfile,
  searchUsers,
  deleteAccount,
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
router.post('/auth/google', googleAuth);
router.post('/auth/apple', appleAuth);
router.post('/send-verification-code', sendVerificationCode);
router.post('/verify-code', verifyCode);
router.post('/send-password-reset-code', sendPasswordResetCode);
router.post('/reset-password', resetPassword);
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

// Route leaderboard
router.get('/leaderboard', authMiddleware, getLeaderboard);

// Route profil public
router.get('/public-profile/:userId', authMiddleware, getUserPublicProfile);

// Route de recherche d'utilisateurs
router.get('/search', authMiddleware, searchUsers);

// Route de suppression de compte
router.delete('/delete-account', authMiddleware, deleteAccount);

export default router;
