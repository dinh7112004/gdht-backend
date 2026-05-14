import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AchievementDocument = Achievement & Document;

@Schema({ timestamps: true })
export class Achievement {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  icon: string; // URL to icon

  @Prop({ unique: true, sparse: true })
  code: string; // Unique code for automatic awarding: FIRST_LESSON, STREAK_7, etc.

  @Prop({ default: 1 })
  level: number;

  @Prop({ default: 'LEARNING' })
  category: string; // LEARNING, SOCIAL, SPECIAL

  @Prop({ 
    required: true, 
    enum: ['LESSONS_COUNT', 'XP_COUNT', 'STREAK_COUNT', 'PERFECT_QUIZZES'],
    default: 'XP_COUNT'
  })
  requirementType: string;

  @Prop({ required: true, default: 0 })
  requirementValue: number;

  @Prop({ default: 0 })
  xpReward: number;

  @Prop({ default: 0 })
  gemReward: number;
}

export const AchievementSchema = SchemaFactory.createForClass(Achievement);
