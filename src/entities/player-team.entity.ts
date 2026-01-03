import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerTeamDocument = PlayerTeam & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class PlayerTeam {
  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  playerId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamId: Types.ObjectId;

  @Prop({
    enum: ['international', 'franchise', 'domestic'],
    required: true,
  })
  teamType: string;

  @Prop({
    enum: ['player', 'captain', 'vice-captain'],
    default: 'player',
  })
  role: string;

  @Prop({
    min: 1,
    max: 99,
  })
  jerseyNumber?: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  fromDate: Date;

  @Prop({ default: null })
  toDate?: Date;
}

export const PlayerTeamSchema = SchemaFactory.createForClass(PlayerTeam);

// Compound indexes
PlayerTeamSchema.index({ playerId: 1, teamId: 1, isActive: 1 });
PlayerTeamSchema.index({ teamId: 1, isActive: 1 });

