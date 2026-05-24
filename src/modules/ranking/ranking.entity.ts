import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RankingDocument = Ranking & Document;

@Schema({ timestamps: true })
export class Ranking {
  @Prop({ type: Types.ObjectId, ref: 'Player', required: false })
  playerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team', required: false })
  teamId?: Types.ObjectId;

  @Prop({ enum: ['player', 'team'], required: true })
  type: string; // 'player' or 'team'

  @Prop({ enum: ['men', 'women'], required: true })
  gender: string;

  @Prop({ enum: ['test', 'odi', 't20', 't20i'], required: true })
  format: string;

  @Prop({ required: false })
  role?: string;

  @Prop({ type: Number, required: false })
  points?: number;

  @Prop({ type: Number, required: true })
  rank: number;

  // Additional fields for scraped data
  @Prop({ required: false })
  name?: string;

  @Prop({ required: false })
  country?: string;

  @Prop({ required: false })
  teamName?: string;

  @Prop({ required: false })
  teamCode?: string;

  @Prop({ required: false })
  cricbuzzId?: string;

  @Prop({ type: Number, required: false })
  matchesPlayed?: number;

  @Prop({ type: Number, required: false })
  rating?: number;

  @Prop({ type: Number, required: false })
  previousRank?: number;

  @Prop({ type: Number, required: false })
  pointsChange?: number;

  @Prop({ type: Number, required: false })
  careerBestRating?: number;

  @Prop({ type: Number, required: false })
  careerBestRank?: number;



  @Prop({ type: Date, default: Date.now })
  lastUpdated: Date;
}

export const RankingSchema = SchemaFactory.createForClass(Ranking);

// Indexes for fast lookup
RankingSchema.index({ type: 1, gender: 1, format: 1, role: 1, name: 1 });
RankingSchema.index({ type: 1, gender: 1, format: 1, teamName: 1 });
