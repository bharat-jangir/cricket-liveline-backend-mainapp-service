import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NewsContentDocument = NewsContent & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class NewsContent {
  @Prop({
    type: Types.ObjectId,
    ref: 'News',
    required: true,
    unique: true,
  })
  newsId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  plainText: string;

  @Prop({
    default: 0,
    min: 0,
  })
  readTime: number;
}

export const NewsContentSchema = SchemaFactory.createForClass(NewsContent);

// Indexes
NewsContentSchema.index({ newsId: 1 });
NewsContentSchema.index({ plainText: 'text' });

