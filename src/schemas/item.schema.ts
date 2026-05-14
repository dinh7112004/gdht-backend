import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ItemDocument = Item & Document;

@Schema({ timestamps: true })
export class Item {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  category: string; // BOOST, DECORATION, AVATAR, FUNCTION, OTHER

  @Prop()
  code: string; // Special identifier for functional items like 'RENAME_CARD'

  @Prop()
  imageUrl: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 'GEMS' })
  currency: string; // GEMS, XP

  @Prop()
  color: string; // Hex color for UI background

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ type: Object, default: {} })
  metadata: any; // Additional properties like multiplier for boosts
}

export const ItemSchema = SchemaFactory.createForClass(Item);
