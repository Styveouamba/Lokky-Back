import mongoose, { Document, Schema } from 'mongoose';

export interface IGalleryPhoto {
  _id?: any; // Mongoose subdocument ID
  url: string;
  publicId: string; // Cloudinary public ID
  caption?: string;
  uploadedAt: Date;
}

export interface IGallery extends Document {
  userId: mongoose.Types.ObjectId;
  photos: IGalleryPhoto[];
  isPublic: boolean; // Si false, seul l'utilisateur peut voir
  createdAt: Date;
  updatedAt: Date;
}

const galleryPhotoSchema = new Schema<IGalleryPhoto>({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  caption: {
    type: String,
    maxlength: 200,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const gallerySchema = new Schema<IGallery>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    photos: {
      type: [galleryPhotoSchema],
      default: [],
      validate: {
        validator: function(photos: IGalleryPhoto[]) {
          return photos.length <= 20; // Max 20 photos
        },
        message: 'Maximum 20 photos allowed in gallery',
      },
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IGallery>('Gallery', gallerySchema);
