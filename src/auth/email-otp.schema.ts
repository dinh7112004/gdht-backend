import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailOtpDocument = EmailOtp & Document;

@Schema()
export class EmailOtp {
  @Prop({ required: true }) email: string;
  @Prop({ required: true }) otp: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ default: 'register' }) type: string; // 'register' | 'forgot'
}

export const EmailOtpSchema = SchemaFactory.createForClass(EmailOtp);
