import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  authProvider: 'email' | 'apple';
  appleId?: string;
  interests?: string[];
  goals?: string[];
  location?: {
    type: string;
    coordinates: [number, number];
  };
  pushToken?: string;
  reputation?: {
    averageRating: number; // Note moyenne en tant que créateur
    totalReviews: number; // Nombre total d'avis reçus
    activitiesCreated: number; // Nombre d'activités créées
    activitiesCompleted: number; // Nombre d'activités complétées
    attendanceRate: number; // Taux de présence (%)
    totalNoShows: number; // Nombre de fois absent
  };
  moderation?: {
    status: 'active' | 'warned' | 'suspended' | 'banned';
    suspendedUntil?: Date;
    warningCount: number;
    reportCount: number;
    lastWarningAt?: Date;
  };
  rateLimit?: {
    lastActivityCreated?: Date;
    activitiesCreatedToday: number;
    lastMessageSent?: Date;
    messagesLastMinute: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function(this: IUser): boolean {
        return this.authProvider === 'email';
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    authProvider: {
      type: String,
      enum: ['email', 'apple'],
      default: 'email',
    },
    appleId: {
      type: String,
      sparse: true,
    },
    interests: {
      type: [String],
      default: [],
    },
    goals: {
      type: [String],
      default: [],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    pushToken: {
      type: String,
    },
    reputation: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      totalReviews: {
        type: Number,
        default: 0,
      },
      activitiesCreated: {
        type: Number,
        default: 0,
      },
      activitiesCompleted: {
        type: Number,
        default: 0,
      },
      attendanceRate: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
      },
      totalNoShows: {
        type: Number,
        default: 0,
      },
    },
    moderation: {
      status: {
        type: String,
        enum: ['active', 'warned', 'suspended', 'banned'],
        default: 'active',
      },
      suspendedUntil: {
        type: Date,
      },
      warningCount: {
        type: Number,
        default: 0,
      },
      reportCount: {
        type: Number,
        default: 0,
      },
      lastWarningAt: {
        type: Date,
      },
    },
    rateLimit: {
      lastActivityCreated: {
        type: Date,
      },
      activitiesCreatedToday: {
        type: Number,
        default: 0,
      },
      lastMessageSent: {
        type: Date,
      },
      messagesLastMinute: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index pour les requêtes géospatiales
userSchema.index({ location: '2dsphere' });

export default mongoose.model<IUser>('User', userSchema);
