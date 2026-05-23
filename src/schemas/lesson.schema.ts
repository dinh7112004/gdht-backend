import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonDocument = Lesson & Document;

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description!: string;

  @Prop({ required: true })
  category!: string; // Tên chủ đề (để hiển thị nhanh)

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId!: Types.ObjectId; // ID của chủ đề (để query chính xác)

  @Prop({ default: 'Toán học' })
  subject!: string; // Toán học, Ngữ văn, Lịch sử, Địa lý...

  @Prop()
  content!: string;

  @Prop()
  imageUrl!: string;

  @Prop({ default: 'medium' })
  difficulty!: string;

  @Prop({ default: 10 })
  estimatedMinutes!: number;

  @Prop({ default: 50 })
  xpReward!: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Class' }], default: [] })
  targetClassIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  creatorId!: Types.ObjectId;

  @Prop({ default: false })
  isPublic!: boolean;

  @Prop({ default: false })
  isSystem!: boolean;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
