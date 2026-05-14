import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ default: 'STUDENT' })
  role: string; // STUDENT, TEACHER, PARENT, ADMIN

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: 1 })
  level: number;

  @Prop({ default: 0 })
  xp: number;

  @Prop({ default: 0 })
  gems: number;

  @Prop({ default: 0 })
  streak: number;

  @Prop()
  avatar: string;

  @Prop({
    type: [
      {
        achievementId: { type: String, ref: 'Achievement' },
        level: { type: Number, default: 1 },
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  achievements: { achievementId: string; level: number; earnedAt: Date }[];

  @Prop({ type: [String], default: [] })
  collections: string[];

  @Prop({
    type: [
      {
        itemId: { type: String, ref: 'Item' },
        quantity: { type: Number, default: 1 },
        acquiredAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  inventory: { itemId: string; quantity: number; acquiredAt: Date }[];

  @Prop({ type: String })
  lastLessonId: string;

  @Prop({
    type: [
      {
        missionId: String,
        claimedAt: Date,
        xpReward: Number,
      },
    ],
    default: [],
  })
  claimedMissions: { missionId: string; claimedAt: Date; xpReward: number }[];

  @Prop({
    type: [
      {
        lessonId: { type: String },
        score: { type: Number },
        total: { type: Number },
        xpGained: { type: Number },
        answers: { type: [Number], default: [] },
        completedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  completedLessons: any[];

  @Prop({
    type: {
      avatarId: { type: String, ref: 'Item' },
      frameId: { type: String, ref: 'Item' },
      effectId: { type: String, ref: 'Item' },
    },
    default: {},
  })
  equippedItems: { avatarId?: string; frameId?: string; effectId?: string };

  @Prop({ default: 0 })
  renameCount: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Post' }], default: [] })
  savedPosts: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
