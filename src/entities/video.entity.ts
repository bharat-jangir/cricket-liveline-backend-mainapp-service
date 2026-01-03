import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema({ timestamps: true })
export class Video {
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
    maxlength: 1000,
    trim: true,
  })
  description?: string;

  @Prop({ required: true })
  videoUrl: string;

  @Prop({ required: true })
  thumbnail: string;

  @Prop({
    required: true,
    min: 0,
  })
  duration: number;

  @Prop({
    enum: ['720p', '1080p', '4k'],
    default: '1080p',
  })
  quality: string;

  @Prop({
    enum: ['highlight', 'analysis', 'interview', 'expert_opinion', 'top_10', 'behind_scenes'],
    required: true,
  })
  type: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'ContentCategory',
    default: null,
  })
  categoryId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    default: null,
  })
  matchId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  authorId: Types.ObjectId;

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

  @Prop({
    enum: ['processing', 'published', 'archived'],
    default: 'processing',
  })
  status: string;

  @Prop({ default: null })
  publishedAt?: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);

// Indexes
VideoSchema.index({ slug: 1 });
VideoSchema.index({ status: 1, publishedAt: -1 });
VideoSchema.index({ matchId: 1, publishedAt: -1 });
VideoSchema.index({ type: 1, publishedAt: -1 });
VideoSchema.index({ authorId: 1, publishedAt: -1 });
VideoSchema.index({ title: 'text', description: 'text' });

