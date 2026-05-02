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
  isRecurring?: boolean; // Activité récurrente (premium uniquement)
  recurringPattern?: {
    frequency: 'weekly'; // Pour l'instant, uniquement hebdomadaire
    dayOfWeek: number; // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
    time: string; // Format HH:mm (ex: "14:30")
    endDate?: Date; // Date de fin de la récurrence (optionnel)
  };
  parentActivityId?: mongoose.Types.ObjectId; // Si c'est une instance d'une activité récurrente
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
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ['weekly'],
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
      },
      time: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      endDate: Date,
    },
    parentActivityId: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
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
