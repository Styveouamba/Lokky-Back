import { Request, Response } from 'express';
import Gallery from '../models/Gallery';
import User from '../models/userModel';
import { uploadImageFromBuffer, deleteImage } from '../utils/cloudinary';

/**
 * Get user's gallery
 * GET /api/gallery/:userId
 */
export const getUserGallery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req as any).userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Find or create gallery
    let gallery = await Gallery.findOne({ userId });
    
    if (!gallery) {
      gallery = await Gallery.create({
        userId,
        photos: [],
        isPublic: true,
      });
    }

    // Check if requesting user can view gallery
    const isOwner = requestingUserId === userId;
    if (!gallery.isPublic && !isOwner) {
      res.status(403).json({ message: 'This gallery is private' });
      return;
    }

    res.json({
      gallery: {
        userId: gallery.userId,
        photos: gallery.photos,
        isPublic: gallery.isPublic,
        isOwner,
        canEdit: isOwner && user.premium?.isActive,
      },
    });
  } catch (error: any) {
    console.error('[Gallery] Error getting gallery:', error);
    res.status(500).json({ message: 'Failed to get gallery', error: error.message });
  }
};

/**
 * Add photo to gallery (Premium only)
 * POST /api/gallery/photos
 */
export const addPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { caption } = req.body;

    // Check if user is premium
    const user = await User.findById(userId);
    if (!user?.premium?.isActive) {
      res.status(403).json({ message: 'Premium subscription required to add photos' });
      return;
    }

    // Check if photo is provided
    if (!req.file) {
      res.status(400).json({ message: 'Photo is required' });
      return;
    }

    // Find or create gallery
    let gallery = await Gallery.findOne({ userId });
    if (!gallery) {
      gallery = await Gallery.create({
        userId,
        photos: [],
        isPublic: true,
      });
    }

    // Check photo limit
    if (gallery.photos.length >= 20) {
      res.status(400).json({ message: 'Maximum 20 photos allowed. Please delete some photos first.' });
      return;
    }

    // Upload to Cloudinary
    const uploadResult = await uploadImageFromBuffer(req.file.buffer, 'gallery');

    // Add photo to gallery
    gallery.photos.push({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      caption: caption || '',
      uploadedAt: new Date(),
    });

    await gallery.save();

    res.status(201).json({
      message: 'Photo added successfully',
      photo: gallery.photos[gallery.photos.length - 1],
    });
  } catch (error: any) {
    console.error('[Gallery] Error adding photo:', error);
    res.status(500).json({ message: 'Failed to add photo', error: error.message });
  }
};

/**
 * Delete photo from gallery
 * DELETE /api/gallery/photos/:photoId
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { photoId } = req.params;

    const gallery = await Gallery.findOne({ userId });
    if (!gallery) {
      res.status(404).json({ message: 'Gallery not found' });
      return;
    }

    // Find photo by ID
    const photoIndex = gallery.photos.findIndex(p => p._id?.toString() === photoId);
    if (photoIndex === -1) {
      res.status(404).json({ message: 'Photo not found' });
      return;
    }

    const photo = gallery.photos[photoIndex];

    // Delete from Cloudinary
    await deleteImage(photo.publicId);

    // Remove from gallery
    gallery.photos.splice(photoIndex, 1);
    await gallery.save();

    res.json({ message: 'Photo deleted successfully' });
  } catch (error: any) {
    console.error('[Gallery] Error deleting photo:', error);
    res.status(500).json({ message: 'Failed to delete photo', error: error.message });
  }
};

/**
 * Update photo caption
 * PATCH /api/gallery/photos/:photoId
 */
export const updatePhotoCaption = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { photoId } = req.params;
    const { caption } = req.body;

    const gallery = await Gallery.findOne({ userId });
    if (!gallery) {
      res.status(404).json({ message: 'Gallery not found' });
      return;
    }

    // Find photo by ID
    const photoIndex = gallery.photos.findIndex(p => p._id?.toString() === photoId);
    if (photoIndex === -1) {
      res.status(404).json({ message: 'Photo not found' });
      return;
    }

    // Update caption
    gallery.photos[photoIndex].caption = caption || '';
    await gallery.save();

    res.json({ message: 'Caption updated successfully', photo: gallery.photos[photoIndex] });
  } catch (error: any) {
    console.error('[Gallery] Error updating caption:', error);
    res.status(500).json({ message: 'Failed to update caption', error: error.message });
  }
};

/**
 * Toggle gallery privacy
 * PATCH /api/gallery/privacy
 */
export const togglePrivacy = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { isPublic } = req.body;

    let gallery = await Gallery.findOne({ userId });
    if (!gallery) {
      gallery = await Gallery.create({
        userId,
        photos: [],
        isPublic: true,
      });
    }

    gallery.isPublic = isPublic;
    await gallery.save();

    res.json({ message: 'Privacy updated successfully', isPublic: gallery.isPublic });
  } catch (error: any) {
    console.error('[Gallery] Error updating privacy:', error);
    res.status(500).json({ message: 'Failed to update privacy', error: error.message });
  }
};

/**
 * Get all public galleries (feed)
 * GET /api/gallery/feed
 */
export const getGalleryFeed = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get galleries with at least one photo, public, and user is premium
    const galleries = await Gallery.find({
      isPublic: true,
      'photos.0': { $exists: true }, // Has at least one photo
    })
      .populate({
        path: 'userId',
        select: 'name avatar premium',
        match: { 'premium.isActive': true }, // Only premium users
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out galleries where user is null (not premium)
    const validGalleries = galleries.filter(g => g.userId);

    const total = await Gallery.countDocuments({
      isPublic: true,
      'photos.0': { $exists: true },
    });

    res.json({
      galleries: validGalleries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[Gallery] Error getting feed:', error);
    res.status(500).json({ message: 'Failed to get gallery feed', error: error.message });
  }
};

export default {
  getUserGallery,
  addPhoto,
  deletePhoto,
  updatePhotoCaption,
  togglePrivacy,
  getGalleryFeed,
};
