import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MilestoneDocument = Milestone & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Milestone {
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
    enum: ['fifty', 'century', 'double_century', 'triple_century', '5_wickets', '10_wickets', 'hat_trick'],
    required: true,
  })
  type: string;

  @Prop({ required: true })
  value: number;

  @Prop({
    required: true,
    min: 0,
  })
  balls: number;

  @Prop({ required: true })
  overNumber: number;

  @Prop({ required: true })
  ballNumber: number;

  @Prop({
    required: true,
    default: Date.now,
  })
  timestamp: Date;
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);

// Compound indexes
MilestoneSchema.index({ playerId: 1, type: 1, createdAt: -1 });
MilestoneSchema.index({ matchId: 1, inningId: 1 });

