import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  authProvider: 'email' | 'apple' | 'google';
  appleId?: string;
  googleId?: string;
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
    // Gamification participants (optionnels pour compatibilité)
    participationStreak?: number; // Série d'activités consécutives
    longestStreak?: number; // Plus longue série
    categoriesExplored?: string[]; // Catégories essayées
    socialScore?: number; // Score social global
    badges?: string[]; // Badges débloqués
    level?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'; // Niveau
    lastActivityDate?: Date; // Date de la dernière activité (pour série)
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
  deletion?: {
    requestedAt?: Date;
    scheduledFor?: Date;
    isDeleted: boolean;
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
      enum: ['email', 'apple', 'google'],
      default: 'email',
    },
    appleId: {
      type: String,
      sparse: true,
    },
    googleId: {
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
      // Gamification participants
      participationStreak: {
        type: Number,
        default: 0,
      },
      longestStreak: {
        type: Number,
        default: 0,
      },
      categoriesExplored: {
        type: [String],
        default: [],
      },
      socialScore: {
        type: Number,
        default: 0,
      },
      badges: {
        type: [String],
        default: [],
      },
      level: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
        default: 'bronze',
      },
      lastActivityDate: {
        type: Date,
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
    deletion: {
      requestedAt: {
        type: Date,
      },
      scheduledFor: {
        type: Date,
      },
      isDeleted: {
        type: Boolean,
        default: false,
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
