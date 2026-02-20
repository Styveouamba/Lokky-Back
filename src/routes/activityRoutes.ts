import { Router } from 'express';
import multer from 'multer';
import {
  createActivity,
  getActivities,
  getActivityById,
  joinActivity,
  leaveActivity,
  updateActivity,
  deleteActivity,
  getMyActivities,
  uploadActivityImage,
  getRecommendedActivities,
  getTrendingActivities,
  getUserPastActivities,
  getUserUpcomingActivities,
  updateActivityStatusEndpoint,
} from '../controllers/activityController';
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

router.use(authMiddleware);

router.post('/', createActivity);
router.get('/', getActivities);
router.get('/my-activities', getMyActivities);
router.get('/past-activities', getUserPastActivities);
router.get('/upcoming-activities', getUserUpcomingActivities);
router.get('/recommended', getRecommendedActivities);
router.get('/trending', getTrendingActivities);
router.post('/upload-image', upload.single('image'), uploadActivityImage);
router.get('/:id', getActivityById);
router.post('/:id/join', joinActivity);
router.delete('/:id/leave', leaveActivity);
router.patch('/:id', updateActivity);
router.patch('/:id/update-status', updateActivityStatusEndpoint);
router.delete('/:id', deleteActivity);

export default router;
