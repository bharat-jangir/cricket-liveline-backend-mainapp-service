import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TournamentDocument = Tournament & Document;

@Schema({ timestamps: true })
export class Tournament {
  @Prop({
    required: true,
    trim: true,
    maxlength: 150,
  })
  name: string;

  @Prop({
    trim: true,
    maxlength: 50,
  })
  shortName?: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  slug: string;

  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  code: string;

  @Prop({
    enum: ['international', 'domestic', 'league', 'bilateral'],
    required: true,
  })
  type: string;

  @Prop({
    enum: ['test', 'odi', 't20', 'mixed'],
    required: true,
  })
  format: string;

  @Prop({
    required: true,
    trim: true,
  })
  season: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({
    required: true,
    trim: true,
  })
  hostCountry: string;

  @Prop({ default: null })
  logo?: string;

  @Prop({ default: null })
  banner?: string;

  @Prop({ default: null })
  coverImage?: string;

  @Prop({ maxlength: 2000 })
  description?: string;

  @Prop({
    enum: ['upcoming', 'live', 'completed', 'cancelled'],
    default: 'upcoming',
  })
  status: string;

  @Prop({
    min: 2,
    default: 0,
  })
  totalTeams: number;

  @Prop({
    min: 0,
    default: 0,
  })
  totalMatches: number;

  @Prop({ default: false })
  groupStage: boolean;

  @Prop({ default: false })
  knockoutStage: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  priority: number;
}

export const TournamentSchema = SchemaFactory.createForClass(Tournament);

// Indexes
TournamentSchema.index({ slug: 1 });
TournamentSchema.index({ code: 1 });
TournamentSchema.index({ status: 1, startDate: -1 });
TournamentSchema.index({ isFeatured: 1, priority: -1 });

