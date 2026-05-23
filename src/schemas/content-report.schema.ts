import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContentReportDocument = ContentReport & Document;

@Schema({ timestamps: true })
export class ContentReport {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId;

  @Prop({ required: true })
  postTitle: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId;

  @Prop({ required: true })
  reporterName: string;

  @Prop({
    required: true,
    enum: ['SPAM', 'INAPPROPRIATE', 'MISINFORMATION', 'HARASSMENT', 'OTHER'],
  })
  reason: string;

  @Prop({ default: '' })
  description: string;

  @Prop({
    default: 'PENDING',
    enum: ['PENDING', 'RESOLVED', 'DISMISSED'],
  })
  status: string;
}

export const ContentReportSchema = SchemaFactory.createForClass(ContentReport);