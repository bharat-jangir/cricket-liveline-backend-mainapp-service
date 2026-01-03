import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type MatchDetailsDocument = MatchDetails & Document;

@Schema({ timestamps: { createdAt: false, updatedAt: true } })
export class MatchDetails {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
    unique: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: {
      tossText: { type: String, trim: true },
      winnerId: { type: Types.ObjectId, ref: 'Team' },
      elected: { type: String, enum: ['bat', 'bowl'] },
      tossTime: { type: Date },
    },
    required: false,
  })
  toss?: {
    tossText?: string;
    winnerId?: Types.ObjectId;
    elected?: string;
    tossTime?: Date;
  };

  @Prop({
    type: {
      winnerId: { type: Types.ObjectId, ref: 'Team' },
      resultType: { type: String, enum: ['normal', 'tie', 'no_result', 'super_over'] },
      winBy: { type: String, enum: ['runs', 'wickets', 'innings', 'tie', 'no_result'] },
      margin: { type: Number },
      resultText: { type: String, trim: true },
      winningTeamId: { type: Types.ObjectId, ref: 'Team' },
      losingTeamId: { type: Types.ObjectId, ref: 'Team' },
      playerOfMatch: { type: Types.ObjectId, ref: 'Player' },
      playerOfSeries: { type: Types.ObjectId, ref: 'Player' },
    },
    required: false,
  })
  result?: {
    winnerId?: Types.ObjectId;
    resultType?: string;
    winBy?: string;
    margin?: number;
    resultText?: string;
    winningTeamId?: Types.ObjectId;
    losingTeamId?: Types.ObjectId;
    playerOfMatch?: Types.ObjectId;
    playerOfSeries?: Types.ObjectId;
  };

  @Prop({
    type: {
      umpire1Id: { type: Types.ObjectId, ref: 'Umpire' },
      umpire2Id: { type: Types.ObjectId, ref: 'Umpire' },
      thirdUmpireId: { type: Types.ObjectId, ref: 'Umpire' },
      refereeId: { type: Types.ObjectId, ref: 'Umpire' },
      reserveUmpireId: { type: Types.ObjectId, ref: 'Umpire' },
    },
    required: false,
  })
  officials?: {
    umpire1Id?: Types.ObjectId;
    umpire2Id?: Types.ObjectId;
    thirdUmpireId?: Types.ObjectId;
    refereeId?: Types.ObjectId;
    reserveUmpireId?: Types.ObjectId;
  };

  @Prop({
    type: {
      weather: { type: String, trim: true },
      temperature: { type: String, trim: true },
      humidity: { type: String, trim: true },
      windSpeed: { type: String, trim: true },
      pitchCondition: { type: String, trim: true },
      pitchReport: { type: String, maxlength: 2000 },
    },
    required: false,
  })
  conditions?: {
    weather?: string;
    temperature?: string;
    humidity?: string;
    windSpeed?: string;
    pitchCondition?: string;
    pitchReport?: string;
  };

  @Prop({ default: false })
  drsAvailable: boolean;

  @Prop({
    default: 0,
    min: 0,
  })
  powerplayOvers: number;
}

export const MatchDetailsSchema = SchemaFactory.createForClass(MatchDetails);

// Indexes
MatchDetailsSchema.index({ matchId: 1 });

