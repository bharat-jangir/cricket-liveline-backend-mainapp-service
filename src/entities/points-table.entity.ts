import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PointsTableDocument = PointsTable & Document;

@Schema({ timestamps: { createdAt: false, updatedAt: true } })
export class PointsTable {
  @Prop({
    type: Types.ObjectId,
    ref: 'Series',
  })
  seriesId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Tournament',
  })
  tournamentId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['test', 'odi', 't20', 't20i'],
  })
  matchFormat?: string;

  @Prop({ trim: true })
  groupName?: string;

  @Prop({
    required: true,
    min: 1,
  })
  position: number;

  @Prop({
    default: 0,
    min: 0,
  })
  played: number;

  @Prop({
    default: 0,
    min: 0,
  })
  won: number;

  @Prop({
    default: 0,
    min: 0,
  })
  lost: number;

  @Prop({
    default: 0,
    min: 0,
  })
  tied: number;

  @Prop({
    default: 0,
    min: 0,
  })
  draw: number;

  @Prop({
    default: 0,
    min: 0,
  })
  noResult: number;

  @Prop({
    default: 0,
    min: 0,
  })
  points: number;

  @Prop({ default: 0 })
  netRunRate: number;

  @Prop({ default: '0/0.0' })
  for: string;

  @Prop({ default: '0/0.0' })
  against: string;

  @Prop({ default: false })
  qualify: boolean;

  @Prop({ trim: true })
  teamFkey?: string;

  @Prop({
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual',
  })
  updateMode: string;
}

export const PointsTableSchema = SchemaFactory.createForClass(PointsTable);

// Compound indexes
PointsTableSchema.index({ seriesId: 1, matchFormat: 1, groupName: 1, position: 1 });
PointsTableSchema.index({ seriesId: 1, teamId: 1, matchFormat: 1 });
PointsTableSchema.index({ tournamentId: 1, groupName: 1, position: 1 });
PointsTableSchema.index({ tournamentId: 1, teamId: 1 });

