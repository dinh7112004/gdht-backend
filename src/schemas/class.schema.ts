import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClassDocument = Class & Document;

@Schema({ timestamps: true })
export class Class {
  @Prop({ required: true })
  name: string; // e.g., "Lớp 5A"

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  teacherId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  coTeacherIds: Types.ObjectId[];

  @Prop({ required: true, unique: true })
  code: string; // e.g., "ABC123"

  @Prop({ default: '#3B82F6' })
  color: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  studentIds: Types.ObjectId[];

  @Prop({ default: 0 })
  averageProgress: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Lesson' }], default: [] })
  assignedLessons: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  assignedCategories: Types.ObjectId[];
}

export const ClassSchema = SchemaFactory.createForClass(Class);
