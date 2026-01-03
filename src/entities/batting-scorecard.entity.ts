import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BattingScorecardDocument = BattingScorecard & Document;

@Schema({ timestamps: true })
export class BattingScorecard {
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
    max: 11,
  })
  battingPosition: number;

  @Prop({
    default: 0,
    min: 0,
  })
  runs: number;

  @Prop({
    default: 0,
    min: 0,
  })
  balls: number;

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

  @Prop({ default: 0 })
  strikeRate: number;

  @Prop({ default: false })
  isOut: boolean;

  @Prop({ default: false })
  isRetiredHurt: boolean;

  @Prop({ default: false })
  isAbsent: boolean;

  @Prop({
    enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'not_out', 'retired_hurt', 'absent'],
    default: 'not_out',
  })
  dismissalType: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  bowlerId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  fielderId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  fielder2Id?: Types.ObjectId;

  @Prop({ trim: true })
  dismissalText?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  dots: number;

  @Prop({
    default: 0,
    min: 0,
  })
  ones: number;

  @Prop({
    default: 0,
    min: 0,
  })
  twos: number;

  @Prop({
    default: 0,
    min: 0,
  })
  threes: number;

  @Prop({ default: false })
  isOnStrike: boolean;

  @Prop({ default: true })
  isVisible: boolean; // Whether this player is visible in the scorecard

  @Prop({ trim: true })
  to?: string; // This Over - runs scored in current over

  @Prop({ trim: true })
  tr?: string; // Total Runs or other custom field
}

export const BattingScorecardSchema = SchemaFactory.createForClass(BattingScorecard);

// Compound indexes
BattingScorecardSchema.index({ inningId: 1, battingPosition: 1 });
BattingScorecardSchema.index({ playerId: 1, matchId: 1 });
BattingScorecardSchema.index({ teamId: 1, inningId: 1 });

