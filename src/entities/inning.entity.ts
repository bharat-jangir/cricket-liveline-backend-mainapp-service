import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema } from 'mongoose';

export type InningDocument = Inning & Document;

@NestSchema({ timestamps: true })
export class Inning {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    required: true,
    min: 1,
    max: 4,
  })
  inningNumber: number;

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
    default: 0,
    min: 0,
  })
  totalRuns: number;

  @Prop({
    default: 0,
    min: 0,
    max: 10,
  })
  totalWickets: number;

  @Prop({
    default: 0,
    min: 0,
  })
  totalOvers: number;

  @Prop({
    default: 0,
    min: 0,
  })
  totalBalls: number;

  @Prop({ default: 0 })
  runRate: number;

  @Prop({
    default: 0,
    min: 0,
  })
  extras: number;

  @Prop({
    default: 0,
    min: 0,
  })
  wides: number;

  @Prop({
    default: 0,
    min: 0,
  })
  noBalls: number;

  @Prop({
    default: 0,
    min: 0,
  })
  byes: number;

  @Prop({
    default: 0,
    min: 0,
  })
  legByes: number;

  @Prop({
    default: 0,
    min: 0,
  })
  penalties: number;

  @Prop({ default: null })
  target?: number;

  @Prop({ default: false })
  isDeclared: boolean;

  @Prop({ default: false })
  isAllOut: boolean;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ default: false })
  isFollowOn: boolean;

  @Prop()
  startTime?: Date;

  @Prop()
  endTime?: Date;

  @Prop({
    type: {
      name: String,
      dismissal: String,
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      to: String,
      tr: { type: Schema.Types.Mixed }, // Can be string or number
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

export const InningSchema = SchemaFactory.createForClass(Inning);

// Compound indexes
InningSchema.index({ matchId: 1, inningNumber: 1 }, { unique: true });
InningSchema.index({ matchId: 1 });

