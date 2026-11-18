import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ArticleDocument = Article & Document;

export const ARTICLE_CATEGORIES = ['general', 'match-report', 'analysis', 'preview', 'tournament', 'transfers', 'rules', 'venues', 'interview'];

/** A news article. `body` is plain text: blank-line separated paragraphs, lines starting with "## " are headings. */
@Schema({ timestamps: true })
export class Article {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ trim: true, maxlength: 500 })
  summary?: string;

  @Prop({ required: true, maxlength: 50000 })
  body: string;

  @Prop({ default: null })
  coverImage?: string;

  @Prop({ enum: ARTICLE_CATEGORIES, default: 'general' })
  category: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ enum: ['draft', 'published', 'archived'], default: 'draft' })
  status: string;

  /** Visible to the public once status=published AND publishedAt <= now (set a future date to schedule). */
  @Prop({ default: null })
  publishedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  authorId?: Types.ObjectId;

  @Prop({ trim: true, maxlength: 100 })
  authorName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Series', default: null })
  seriesId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Match', default: null })
  matchId?: Types.ObjectId;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0, min: 0 })
  views: number;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);
ArticleSchema.index({ status: 1, publishedAt: -1 });
ArticleSchema.index({ category: 1, publishedAt: -1 });
ArticleSchema.index({ title: 'text', summary: 'text' });
