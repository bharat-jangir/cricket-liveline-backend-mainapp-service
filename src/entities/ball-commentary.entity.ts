import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BallCommentaryDocument = BallCommentary & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class BallCommentary {
  @Prop({
    type: Types.ObjectId,
    ref: 'Ball',
    required: true,
  })
  ballId: Types.ObjectId;

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
    maxlength: 1000,
  })
  commentary: string;

  @Prop({ maxlength: 200 })
  shortText?: string;

  @Prop({
    enum: ['ball', 'over', 'milestone', 'wicket', 'event'],
    default: 'ball',
  })
  commentaryType: string;
}

export const BallCommentarySchema = SchemaFactory.createForClass(BallCommentary);

// Indexes
BallCommentarySchema.index({ ballId: 1 });
BallCommentarySchema.index({ matchId: 1, createdAt: -1 });

