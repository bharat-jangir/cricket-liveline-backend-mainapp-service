import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShortDocument = Short & Document;

/** A short vertical video clip. videoUrl must be a direct, playable file/stream URL (mp4 or HLS .m3u8). */
@Schema({ timestamps: true })
export class Short {
  @Prop({ required: true, trim: true, maxlength: 150 })
  title: string;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({ required: true })
  videoUrl: string;

  @Prop({ default: null })
  thumbnail?: string;

  @Prop({ default: 0, min: 0 })
  durationSec: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ enum: ['draft', 'published', 'archived'], default: 'draft' })
  status: string;

  @Prop({ default: null })
  publishedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  authorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Match', default: null })
  matchId?: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  views: number;

  @Prop({ default: 0, min: 0 })
  likes: number;
}

export const ShortSchema = SchemaFactory.createForClass(Short);
ShortSchema.index({ status: 1, publishedAt: -1 });
