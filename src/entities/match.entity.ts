import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchDocument = Match & Document;

@Schema({ timestamps: true })
export class Match {
  @Prop({
    required: true,
    trim: true,
  })
  matchNumber: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  shortTitle: string;

  @Prop({
    trim: true,
    maxlength: 200,
  })
  subtitle?: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  slug: string;

  // @Prop({
  //   type: Types.ObjectId,
  //   // ref: 'Tournament', // Removed ref - Tournament model not registered
  //   default: null,
  // })
  // tournamentId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Series',
    default: null,
  })
  seriesId?: Types.ObjectId;

  @Prop({
    enum: ['international', 'domestic', 'league'],
    required: true,
  })
  matchType: string;

  @Prop({
    enum: ['test', 'odi', 't20', 't20i'],
    required: true,
  })
  matchFormat: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamAId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamBId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Venue',
    required: true,
  })
  venueId: Types.ObjectId;

  @Prop({ required: true })
  matchDate: Date;

  @Prop()
  matchTime?: Date; // Timestamp for match time

  @Prop({ trim: true })
  localTime?: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({
    enum: ['scheduled', 'live', 'completed', 'abandoned', 'cancelled'],
    default: 'scheduled',
  })
  status: string;

  @Prop({
    enum: ['toss_pending', 'innings_break', 'tea', 'lunch', 'stumps', 'rain_delay', 'normal'],
    default: 'toss_pending',
  })
  matchState: string;

  @Prop({
    min: 1,
    max: 4,
    default: 1,
  })
  currentInning: number;

  @Prop({
    min: 2,
    max: 4,
    default: 2,
  })
  totalInnings: number;

  @Prop({ min: 1 })
  dayNumber?: number;

  @Prop({ min: 1 })
  sessionNumber?: number;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  priority: number;

  @Prop({
    default: 0,
    min: 0,
  })
  views: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy?: Types.ObjectId;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// Indexes
MatchSchema.index({ slug: 1 });
MatchSchema.index({ status: 1, matchDate: -1 });
MatchSchema.index({ tournamentId: 1, matchDate: -1 });
MatchSchema.index({ teamAId: 1, teamBId: 1, status: 1 });
MatchSchema.index({ venueId: 1, matchDate: -1 });
MatchSchema.index({ seriesId: 1, matchDate: -1 });

