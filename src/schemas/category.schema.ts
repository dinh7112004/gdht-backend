import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name: string; // Tên chủ đề: Ca dao, Truyện Kiều, Lễ hội...

  @Prop({ default: 'Toán học' })
  subject: string; // Toán học, Ngữ văn, Lịch sử, Địa lý...

  @Prop()
  description: string;

  @Prop()
  imageUrl: string; // Ảnh đại diện cho chủ đề

  @Prop({ default: false })
  isFeatured: boolean; // Có hiển thị ở phần "Nổi bật" trên App hay không

  @Prop({ default: 0 })
  order: number; // Thứ tự hiển thị

  @Prop({ type: [{ type: 'ObjectId', ref: 'Class' }], default: [] })
  targetClassIds: any[];

  @Prop({ type: 'ObjectId', ref: 'User' })
  creatorId: any;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: false })
  isSystem: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
