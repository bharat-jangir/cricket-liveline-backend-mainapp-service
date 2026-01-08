import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type LiveMatchStatusDocument = LiveMatchStatus & Document;

@Schema({ timestamps: false })
export class LiveMatchStatus {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
    unique: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    required: true,
    min: 1,
    max: 4,
  })
  currentInning: number;

  @Prop({
    required: true,
    min: 0,
  })
  currentOver: number;

  @Prop({
    required: true,
  })
  currentBall: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: false,
  })
  battingTeamId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: false,
  })
  bowlingTeamId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: false,
  })
  currentBowlerId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: false,
  })
  currentStrikerId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: false,
  })
  currentNonStrikerId?: Types.ObjectId;

  @Prop({
    required: true,
    default: '0/0',
  })
  score: string;

  @Prop({
    required: true,
    default: '0.0',
  })
  overs: string;

  @Prop({
    default: 0,
    min: 0,
  })
  balls: number;

  @Prop({ default: 0 })
  runRate: number;

  @Prop({ default: 0 })
  requiredRunRate: number;

  @Prop({ default: 0 })
  target: number;

  @Prop({ default: 0 })
  ballsRemaining: number;

  // Odds fields
  @Prop({ type: String, default: '' })
  oddsTeam?: string;

  @Prop({ type: Number, default: 0 })
  oddsBlue?: number;

  @Prop({ type: Number, default: 0 })
  oddsRed?: number;

  @Prop({ type: Number, default: 0 })
  session?: number;

  @Prop({ type: Number, default: 0 })
  sessionBlue?: number;

  @Prop({ type: Number, default: 0 })
  sessionRed?: number;

  @Prop({ type: Number, default: 0 })
  lambi?: number;

  @Prop({ type: Number, default: 0 })
  lambiBlue?: number;

  @Prop({ type: Number, default: 0 })
  lambiRed?: number;

  @Prop({
    default: Date.now,
  })
  lastUpdated: Date;

  @Prop({ default: false })
  powerPlay: boolean;

  @Prop({ default: true })
  isNew: boolean;

  @Prop({ default: false })
  noScorecards: boolean;

  @Prop({ default: false })
  viewMode: boolean;

  @Prop({ default: false })
  isNotShowing: boolean;

  @Prop({ default: false })
  dls: boolean;

  @Prop({ default: false })
  noCommentry: boolean;

  @Prop({ default: false })
  onOC: boolean;

  @Prop({ default: '' })
  comment2: string;

  @Prop({
    type: {
      name: String,
      dismissal: String,
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      to: String,
      tr: { type: MongooseSchema.Types.Mixed },
      playerId: { type: Types.ObjectId, ref: 'Player' },
    },
    default: null,
  })
  lastWicket?: {
    name: string;
    dismissal: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    to: string;
    tr: any;
    playerId: Types.ObjectId;
  };
}

export const LiveMatchStatusSchema = SchemaFactory.createForClass(LiveMatchStatus);

// Indexes
LiveMatchStatusSchema.index({ matchId: 1 });
LiveMatchStatusSchema.index({ lastUpdated: -1 });

