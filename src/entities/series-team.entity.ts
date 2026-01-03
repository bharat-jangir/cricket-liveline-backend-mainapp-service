import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Embedded sub-document for squad players
@Schema({ _id: false })
export class SeriesSquadPlayer {
  @Prop({ type: Types.ObjectId, ref: 'Player', required: true })
  playerId: Types.ObjectId;

  @Prop({ default: false })
  isCaptain: boolean;

  @Prop({ default: false })
  isViceCaptain: boolean;

  @Prop({ default: false })
  isWicketKeeper: boolean;

  @Prop({ default: false })
  isNotEligible: boolean;

  @Prop({ 
    enum: ['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'],
    default: 'Batter'
  })
  role: string;

  @Prop({ min: 1, max: 99 })
  jerseyNumber?: number;
}

export const SeriesSquadPlayerSchema = SchemaFactory.createForClass(SeriesSquadPlayer);

@Schema({ timestamps: true })
export class SeriesTeam extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Series', required: true })
  seriesId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team', required: true })
  teamId: Types.ObjectId;

  @Prop({ 
    enum: ['ODI', 'T20', 'Test', 'T10', '100B'],
    required: true
  })
  format: string; // Format-specific squad

  @Prop({ trim: true })
  groupName?: string; // For tournaments (e.g., "Group A")

  @Prop({ default: false })
  isQualified: boolean; // For knockout stages

  @Prop({ 
    enum: ['semi-final', 'final', 'quarter-final', null],
    default: null
  })
  qualifiedFor?: string;

  @Prop({ type: [SeriesSquadPlayerSchema], default: [] })
  squadPlayers: SeriesSquadPlayer[];

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const SeriesTeamSchema = SchemaFactory.createForClass(SeriesTeam);

// Compound index to ensure one team per series per format
SeriesTeamSchema.index({ seriesId: 1, teamId: 1, format: 1 }, { unique: true });

// Additional indexes for common queries
SeriesTeamSchema.index({ seriesId: 1, format: 1 }); // For getSeriesTeams by format
SeriesTeamSchema.index({ seriesId: 1, isActive: 1 }); // For filtering active teams
SeriesTeamSchema.index({ teamId: 1 }); // For team-based queries

// Additional indexes for common queries
SeriesTeamSchema.index({ seriesId: 1, format: 1 }); // For getSeriesTeams by format
SeriesTeamSchema.index({ seriesId: 1, isActive: 1 }); // For filtering active teams
SeriesTeamSchema.index({ teamId: 1 }); // For team-based queries

