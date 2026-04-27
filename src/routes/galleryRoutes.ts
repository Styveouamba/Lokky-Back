import express from 'express';
import multer from 'multer';
import {
  getUserGallery,
  addPhoto,
  deletePhoto,
  updatePhotoCaption,
  togglePrivacy,
  getGalleryFeed,
} from '../controllers/galleryController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePremium } from '../middleware/premiumMiddleware';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Public routes
router.get('/feed', authMiddleware, getGalleryFeed);
router.get('/:userId', authMiddleware, getUserGallery);

// Premium-only routes
router.post('/photos', authMiddleware, requirePremium, upload.single('photo'), addPhoto);
router.delete('/photos/:photoId', authMiddleware, deletePhoto);
router.patch('/photos/:photoId', authMiddleware, updatePhotoCaption);
router.patch('/privacy', authMiddleware, togglePrivacy);

export default router;
