import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LiveMatchSessionDocument = LiveMatchSession & Document;

@Schema({ timestamps: true })
export class LiveMatchSession {
    @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
    matchId: Types.ObjectId;

    @Prop({ required: true })
    session: number;

    @Prop({ required: true })
    open: number;

    @Prop({ default: 0 })
    pass: number;

    @Prop({ default: 0 })
    min: number;

    @Prop({ default: 0 })
    max: number;
}

export const LiveMatchSessionSchema = SchemaFactory.createForClass(LiveMatchSession);
