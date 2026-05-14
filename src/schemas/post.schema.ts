import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true, enum: ['TEACHING_METHOD', 'LEARNING_TIP', 'DISCUSSION'] })
  type: string;

  @Prop({ default: 'PENDING', enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  status: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({
    type: [{
      authorId: { type: Types.ObjectId, ref: 'User' },
      authorName: String,
      content: String,
      createdAt: { type: Date, default: Date.now }
    }],
    default: []
  })
  comments: any[];

  @Prop({ default: 0 })
  views: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);
