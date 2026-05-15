import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LessonDocument = Lesson & Document;

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  category: string; // Tên chủ đề (để hiển thị nhanh)

  @Prop({ type: 'ObjectId', ref: 'Category' })
  categoryId: any; // ID của chủ đề (để query chính xác)

  @Prop({ default: 'Toán học' })
  subject: string; // Toán học, Ngữ văn, Lịch sử, Địa lý...

  @Prop()
  content: string;

  @Prop()
  imageUrl: string;

  @Prop({ default: 'medium' })
  difficulty: string;

  @Prop({ default: 10 })
  estimatedMinutes: number;

  @Prop({ default: 50 })
  xpReward: number;

  @Prop({ type: [{ type: 'ObjectId', ref: 'Class' }], default: [] })
  targetClassIds: any[];

  @Prop({ type: 'ObjectId', ref: 'User' })
  creatorId: any;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: false })
  isSystem: boolean;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
