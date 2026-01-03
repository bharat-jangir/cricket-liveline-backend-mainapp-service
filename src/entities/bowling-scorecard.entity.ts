import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BowlingScorecardDocument = BowlingScorecard & Document;

@Schema({ timestamps: true })
export class BowlingScorecard {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Inning',
    required: true,
  })
  inningId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  playerId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamId: Types.ObjectId;

  @Prop({
    required: true,
    min: 1,
  })
  bowlingOrder: number;

  @Prop({
    default: 0,
    min: 0,
  })
  overs: number;

  @Prop({
    default: 0,
    min: 0,
  })
  completedOvers: number;

  @Prop({
    default: 0,
    min: 0,
  })
  balls: number;

  @Prop({
    default: 0,
    min: 0,
  })
  maidens: number;

  @Prop({
    default: 0,
    min: 0,
  })
  runs: number;

  @Prop({
    default: 0,
    min: 0,
  })
  wickets: number;

  @Prop({
    default: 0,
    min: 0,
  })
  noBalls: number;

  @Prop({
    default: 0,
    min: 0,
  })
  wides: number;

  @Prop({ default: 0 })
  economy: number;

  @Prop({ default: 0 })
  strikeRate: number;

  @Prop({ default: 0 })
  average: number;

  @Prop({
    default: 0,
    min: 0,
  })
  dots: number;

  @Prop({
    default: 0,
    min: 0,
  })
  fours: number;

  @Prop({
    default: 0,
    min: 0,
  })
  sixes: number;

  @Prop({ default: true })
  isVisible: boolean; // Whether this player is visible in the scorecard

  @Prop({ default: false })
  isCurrentBowler: boolean; // Whether this bowler is currently bowling
}

export const BowlingScorecardSchema = SchemaFactory.createForClass(BowlingScorecard);

// Compound indexes
BowlingScorecardSchema.index({ inningId: 1, bowlingOrder: 1 });
BowlingScorecardSchema.index({ playerId: 1, matchId: 1 });
BowlingScorecardSchema.index({ teamId: 1, inningId: 1 });

