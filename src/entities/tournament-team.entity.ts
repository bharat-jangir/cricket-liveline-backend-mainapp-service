import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TournamentTeamDocument = TournamentTeam & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class TournamentTeam {
  @Prop({
    type: Types.ObjectId,
    ref: 'Tournament',
    required: true,
  })
  tournamentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamId: Types.ObjectId;

  @Prop({ trim: true })
  groupName?: string;

  @Prop({ min: 1 })
  seedNumber?: number;

  @Prop({ default: false })
  isQualified: boolean;

  @Prop({
    enum: ['semi-final', 'final', null],
    default: null,
  })
  qualifiedFor?: string;
}

export const TournamentTeamSchema = SchemaFactory.createForClass(TournamentTeam);

// Compound indexes
TournamentTeamSchema.index({ tournamentId: 1, teamId: 1 }, { unique: true });
TournamentTeamSchema.index({ tournamentId: 1, groupName: 1 });

