import mongoose, { Document, Schema } from 'mongoose';

export interface IActivity extends Document {
  title: string;
  description?: string;
  category: string;
  tags: string[];
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    name: string;
    city?: string;
  };
  date: Date;
  duration?: number; // Durée en heures (optionnel, par défaut 2h)
  createdBy: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  maxParticipants: number;
  imageUrl?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  groupId?: mongoose.Types.ObjectId; // Référence au groupe de discussion
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['sport', 'food', 'culture', 'nightlife', 'outdoor', 'gaming', 'networking', 'other'],
    },
    tags: [{
      type: String,
      trim: true,
    }],
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      city: String,
    },
    date: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      default: 2, // Durée par défaut de 2 heures
      min: 0.5,
      max: 24,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    maxParticipants: {
      type: Number,
      required: true,
      min: 2,
      max: 100,
    },
    imageUrl: String,
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ location: '2dsphere' });
activitySchema.index({ date: 1 });
activitySchema.index({ category: 1 });
activitySchema.index({ tags: 1 });

export default mongoose.model<IActivity>('Activity', activitySchema);
