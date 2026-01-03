import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FantasyStatsDocument = FantasyStats & Document;

@Schema({ timestamps: true })
export class FantasyStats {
  @Prop({
    type: Types.ObjectId,
    ref: 'Series',
    required: true,
  })
  seriesId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  playerId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
  })
  teamId?: Types.ObjectId;

  @Prop({
    enum: ['wicket-keeper', 'batsman', 'all-rounder', 'bowler'],
    required: true,
  })
  role: string;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  points: number; // Fantasy points earned in this match

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  credits: number; // Fantasy credits/cost for this player in this match

  @Prop({ default: false })
  isCaptain: boolean;

  @Prop({ default: false })
  isViceCaptain: boolean;

  // Match performance stats that contribute to fantasy points
  @Prop({ default: 0, min: 0 })
  runs?: number;

  @Prop({ default: 0, min: 0 })
  wickets?: number;

  @Prop({ default: 0, min: 0 })
  catches?: number;

  @Prop({ default: 0, min: 0 })
  stumpings?: number;

  @Prop({ default: 0, min: 0 })
  fours?: number;

  @Prop({ default: 0, min: 0 })
  sixes?: number;

  @Prop({ default: 0, min: 0 })
  maidens?: number;

  @Prop({ default: 0, min: 0 })
  economy?: number; // Bowling economy rate

  @Prop({ default: false })
  isManOfTheMatch?: boolean;

  @Prop({ default: false })
  isPlaying?: boolean; // Whether player played in this match

  createdAt: Date;
  updatedAt: Date;
}

export const FantasyStatsSchema = SchemaFactory.createForClass(FantasyStats);

// Compound index to ensure one entry per player per match
FantasyStatsSchema.index({ matchId: 1, playerId: 1 }, { unique: true });

// Indexes for common queries
FantasyStatsSchema.index({ seriesId: 1, matchId: 1 });
FantasyStatsSchema.index({ playerId: 1 });
FantasyStatsSchema.index({ matchId: 1 });
FantasyStatsSchema.index({ seriesId: 1 });

