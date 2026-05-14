import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MissionDocument = Mission & Document;

@Schema({ timestamps: true })
export class Mission {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  type: string; // DAILY, WEEKLY, STREAK, SPECIAL

  @Prop({ required: true })
  requirementType: string; // LESSONS_COUNT, QUIZ_COUNT, STREAK_COUNT, XP_COUNT

  @Prop({ required: true })
  requirementValue: number;

  @Prop({ default: 0 })
  xpReward: number;

  @Prop({ default: 0 })
  gemReward: number;

  @Prop()
  itemRewardId: string; // Optional item reward

  @Prop({ default: true })
  isActive: boolean;
}

export const MissionSchema = SchemaFactory.createForClass(Mission);
