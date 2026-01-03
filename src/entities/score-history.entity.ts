import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ScoreHistoryDocument = ScoreHistory & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ScoreHistory {
    @Prop({ type: Types.ObjectId, ref: 'Match', required: true, index: true })
    matchId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Inning', required: true })
    inningId: Types.ObjectId;

    @Prop({ required: true })
    ballNumber: number; // Global ball counter for the match/inning

    @Prop({ type: MongooseSchema.Types.Mixed, required: true })
    event: any; // The BallEvent object

    @Prop({ type: MongooseSchema.Types.Mixed, required: true })
    stateSnapshot: any; // Full snapshot of MatchState BEFORE this event (for easy undo)
}

export const ScoreHistorySchema = SchemaFactory.createForClass(ScoreHistory);
ScoreHistorySchema.index({ matchId: 1, ballNumber: -1 });
