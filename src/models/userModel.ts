import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  authProvider: 'email' | 'apple';
  appleId?: string;
  interests?: string[];
  goals?: string[];
  location?: {
    type: string;
    coordinates: [number, number];
  };
  pushToken?: string;
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
  },
  {
    timestamps: true,
  }
);

// Index pour les requêtes géospatiales
userSchema.index({ location: '2dsphere' });

export default mongoose.model<IUser>('User', userSchema);
