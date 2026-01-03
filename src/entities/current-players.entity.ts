import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CurrentPlayersDocument = CurrentPlayers & Document;

@Schema({ timestamps: false })
export class CurrentPlayers {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
    unique: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Inning',
    required: true,
  })
  inningId: Types.ObjectId;

  @Prop({
    playerId: { type: Types.ObjectId, ref: 'Player', required: true },
    runs: { type: Number, default: 0, min: 0 },
    balls: { type: Number, default: 0, min: 0 },
    fours: { type: Number, default: 0, min: 0 },
    sixes: { type: Number, default: 0, min: 0 },
    sr: { type: Number, default: 0 },
  })
  striker: {
    playerId: Types.ObjectId;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    sr: number;
  };

  @Prop({
    playerId: { type: Types.ObjectId, ref: 'Player', required: true },
    runs: { type: Number, default: 0, min: 0 },
    balls: { type: Number, default: 0, min: 0 },
    fours: { type: Number, default: 0, min: 0 },
    sixes: { type: Number, default: 0, min: 0 },
    sr: { type: Number, default: 0 },
  })
  nonStriker: {
    playerId: Types.ObjectId;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    sr: number;
  };

  @Prop({
    playerId: { type: Types.ObjectId, ref: 'Player', required: true },
    overs: { type: Number, default: 0, min: 0 },
    maidens: { type: Number, default: 0, min: 0 },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0 },
    economy: { type: Number, default: 0 },
  })
  bowler: {
    playerId: Types.ObjectId;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
  };

  @Prop({
    default: Date.now,
  })
  lastUpdated: Date;
}

export const CurrentPlayersSchema = SchemaFactory.createForClass(CurrentPlayers);

// Indexes
CurrentPlayersSchema.index({ matchId: 1 });
CurrentPlayersSchema.index({ lastUpdated: -1 });

