import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchSquadDocument = MatchSquad & Document;

@Schema({ timestamps: true })
export class MatchSquad {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamId: Types.ObjectId;

  @Prop({
    type: [Types.ObjectId],
    ref: 'Player',
    validate: {
      validator: (v: Types.ObjectId[]) => v.length === 11,
      message: 'Playing XI must have exactly 11 players',
    },
  })
  playingXI?: Types.ObjectId[];

  @Prop({
    type: [Types.ObjectId],
    ref: 'Player',
    default: [],
  })
  bench: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
  })
  captainId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
  })
  viceCaptainId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
  })
  wicketKeeperId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
  })
  impactPlayerId?: Types.ObjectId;
}

export const MatchSquadSchema = SchemaFactory.createForClass(MatchSquad);

// Compound indexes
MatchSquadSchema.index({ matchId: 1, teamId: 1 }, { unique: true });

