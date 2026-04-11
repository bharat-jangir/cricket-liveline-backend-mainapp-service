import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NewsDocument = News & Document;

@Schema({ timestamps: true })
export class News {
  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  slug: string;

  @Prop({
    maxlength: 500,
    trim: true,
  })
  excerpt?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'ContentCategory',
    required: true,
  })
  categoryId: Types.ObjectId;

  @Prop({
    type: [String],
    validate: {
      validator: (v: string[]) => v.length <= 10,
      message: 'Tags cannot exceed 10',
    },
    default: [],
  })
  tags: string[];

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  authorId: Types.ObjectId;

  @Prop({ default: null })
  featuredImage?: string;

  @Prop({
    enum: ['draft', 'scheduled', 'published', 'archived'],
    default: 'draft',
  })
  status: string;

  @Prop({ default: null })
  publishedAt?: Date;

  @Prop({ default: null })
  scheduledAt?: Date;

  @Prop({
    default: 0,
    min: 0,
  })
  views: number;

  @Prop({
    default: 0,
    min: 0,
  })
  likes: number;

  @Prop({
    default: 0,
    min: 0,
  })
  shares: number;

  @Prop({ default: false })
  isTrending: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isBreaking: boolean;

  @Prop({ default: 0 })
  priority: number;
}

export const NewsSchema = SchemaFactory.createForClass(News);

// Indexes

NewsSchema.index({ status: 1, publishedAt: -1 });
NewsSchema.index({ categoryId: 1, publishedAt: -1 });
NewsSchema.index({ authorId: 1, publishedAt: -1 });
NewsSchema.index({ isTrending: 1, publishedAt: -1 });
NewsSchema.index({ title: 'text', excerpt: 'text' });

