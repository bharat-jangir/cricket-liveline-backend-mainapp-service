import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FallOfWicketDocument = FallOfWicket & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class FallOfWicket {
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
    required: true,
  })
  batsmanId: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
  })
  batsmanName: string;

  @Prop({ required: true })
  score: string;

  @Prop({ required: true })
  totalRuns: number;

  @Prop({ required: true })
  overNumber: number;

  @Prop({ required: true })
  ballNumber: number;

  @Prop({
    enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket'],
    required: true,
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
    required: true,
    default: Date.now,
  })
  timestamp: Date;
}

export const FallOfWicketSchema = SchemaFactory.createForClass(FallOfWicket);

// Compound indexes
FallOfWicketSchema.index({ matchId: 1, inningId: 1, wicketNumber: 1 }, { unique: true });

