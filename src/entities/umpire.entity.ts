import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UmpireDocument = Umpire & Document;

@Schema({ timestamps: true })
export class Umpire {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Date })
  dob?: Date;

  @Prop()
  placeOfBirth?: string;

  @Prop()
  height?: string;

  @Prop({ type: Number, default: 0 })
  testMatches?: number;

  @Prop({ type: Number, default: 0 })
  odiMatches?: number;

  @Prop({ type: Number, default: 0 })
  t20Matches?: number;

  @Prop({ type: Number, default: 0 })
  otherMatches?: number;

  @Prop()
  careerStart?: string;

  @Prop()
  image?: string;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const UmpireSchema = SchemaFactory.createForClass(Umpire);

// Indexes
UmpireSchema.index({ name: 1 });
UmpireSchema.index({ createdAt: -1 });
UmpireSchema.index({ isActive: 1 });
