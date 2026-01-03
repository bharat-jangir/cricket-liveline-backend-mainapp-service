import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BallDocument = Ball & Document;

@Schema({ timestamps: true })
export class Ball {
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
    required: true,
    min: 1,
  })
  overNumber: number;

  @Prop({
    required: true,
    min: 1,
    max: 6,
  })
  ballNumber: number;

  @Prop({
    required: true,
    min: 1,
  })
  ballInOver: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  bowlerId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  strikerId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  nonStrikerId: Types.ObjectId;

  @Prop({
    default: 0,
    min: 0,
    max: 6,
  })
  runsScored: number;

  @Prop({
    default: 0,
    min: 0,
  })
  extrasRuns: number;

  @Prop({
    required: true,
    min: 0,
  })
  totalRuns: number;

  @Prop({ default: false })
  isWicket: boolean;

  @Prop({ default: false })
  isBoundary: boolean;

  @Prop({ default: false })
  isSix: boolean;

  @Prop({ default: false })
  isDot: boolean;

  @Prop({
    enum: ['wide', 'no_ball', 'bye', 'leg_bye', null],
    default: null,
  })
  extraType?: string;

  @Prop({
    enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', null],
    default: null,
  })
  wicketType?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  dismissedPlayerId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  dismissedByBowlerId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  dismissedByFielderId?: Types.ObjectId;

  @Prop({ trim: true })
  shotType?: string;

  @Prop({ default: false })
  isReviewed: boolean;

  @Prop({
    enum: ['out', 'not_out', 'umpires_call', null],
    default: null,
  })
  reviewOutcome?: string;

  @Prop({
    runs: { type: Number, required: true },
    wickets: { type: Number, required: true },
    overs: { type: String, required: true },
  })
  matchScore: {
    runs: number;
    wickets: number;
    overs: string;
  };

  @Prop({
    required: true,
    default: Date.now,
  })
  timestamp: Date;
}

export const BallSchema = SchemaFactory.createForClass(Ball);

// Compound indexes
BallSchema.index({ matchId: 1, inningId: 1, overNumber: 1, ballNumber: 1 });
BallSchema.index({ matchId: 1, timestamp: -1 });
BallSchema.index({ bowlerId: 1, timestamp: -1 });
BallSchema.index({ strikerId: 1, timestamp: -1 });
BallSchema.index({ matchId: 1, inningId: 1, isWicket: 1 });

// TTL Index - expire after 180 days
BallSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

