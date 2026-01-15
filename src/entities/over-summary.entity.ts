import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type OverSummaryDocument = OverSummary & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class OverSummary {
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
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  bowlerId: Types.ObjectId;

  @Prop({
    default: 0,
    min: 0,
  })
  runs: number;

  @Prop({
    default: 0,
    min: 0,
    max: 10,
  })
  wickets: number;

  @Prop({
    default: 0,
    min: 0,
  })
  extras: number;

  @Prop({
    type: [MongooseSchema.Types.Mixed],
    validate: {
      validator: (v: any[]) => v.length <= 12,
      message: 'Balls data cannot exceed 12',
    },
  })
  ballsData?: any[];

  @Prop({ default: false })
  isMaiden: boolean;
}

export const OverSummarySchema = SchemaFactory.createForClass(OverSummary);

// Compound indexes
OverSummarySchema.index({ matchId: 1, inningId: 1, overNumber: 1 }, { unique: true });

