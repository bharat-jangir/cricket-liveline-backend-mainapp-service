import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PartnershipDocument = Partnership & Document;

@Schema({ timestamps: true })
export class Partnership {
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
    max: 10,
  })
  wicketNumber: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: false,
  })
  batsman1Id: Types.ObjectId;

  @Prop({
    default: 0,
    min: 0,
  })
  batsman1Runs: number;

  @Prop({
    default: 0,
    min: 0,
  })
  batsman1Balls: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: false,
  })
  batsman2Id: Types.ObjectId;

  @Prop({
    default: 0,
    min: 0,
  })
  batsman2Runs: number;

  @Prop({
    default: 0,
    min: 0,
  })
  batsman2Balls: number;

  @Prop({
    default: 0,
    min: 0,
  })
  totalRuns: number;

  @Prop({
    default: 0,
    min: 0,
  })
  totalBalls: number;

  @Prop({ default: false })
  isActive: boolean;

  // Frontend custom fields
  @Prop()
  batsman?: string;

  @Prop()
  nbKey?: string;

  @Prop()
  obKey?: string;

  @Prop()
  nbName?: string;

  @Prop()
  obName?: string;

  @Prop()
  nbRun?: string;

  @Prop()
  obRun?: string;

  @Prop()
  nbBall?: string;

  @Prop()
  obBall?: string;

  @Prop()
  score?: string;

  @Prop()
  wicket?: string;

  @Prop({ default: false })
  isBroken: boolean;

  @Prop({ min: 0 })
  startOver?: number;

  @Prop({ min: 0 })
  endOver?: number;
}

export const PartnershipSchema = SchemaFactory.createForClass(Partnership);

// Compound indexes
PartnershipSchema.index({ matchId: 1, inningId: 1, wicketNumber: 1 }, { unique: true });

