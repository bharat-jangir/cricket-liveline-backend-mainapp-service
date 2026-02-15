import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchDocument = Match & Document;

@Schema({ timestamps: true })
export class Match {
  @Prop({
    required: true,
    trim: true,
  })
  matchNumber: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  shortTitle: string;

  @Prop({
    trim: true,
    maxlength: 200,
  })
  subtitle?: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  slug: string;

  // @Prop({
  //   type: Types.ObjectId,
  //   // ref: 'Tournament', // Removed ref - Tournament model not registered
  //   default: null,
  // })
  // tournamentId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Series',
    default: null,
  })
  seriesId?: Types.ObjectId;

  @Prop({
    enum: ['international', 'domestic', 'league'],
    required: true,
  })
  matchType: string;

  @Prop({
    enum: ['test', 'odi', 't20', 't20i', 't10', 'hundred'],
    required: true,
  })
  matchFormat: string;

  @Prop({ default: 6 })
  ballsPerOver: number;

  @Prop({ default: 20 })
  oversPerInning: number;

  @Prop({ default: 0 })
  maxBowlerLimit: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Venue',
    default: null,
  })
  venueId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamAId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  teamBId: Types.ObjectId;


  @Prop({ required: true })
  matchDate: Date;

  @Prop()
  matchTime?: Date; // Timestamp for match time

  @Prop({ trim: true })
  localTime?: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({
    enum: ['scheduled', 'live', 'completed', 'abandoned', 'cancelled'],
    default: 'scheduled',
  })
  status: string;

  @Prop({
    enum: ['toss_pending', 'innings_break', 'tea', 'lunch', 'stumps', 'rain_delay', 'normal'],
    default: 'toss_pending',
  })
  matchState: string;

  @Prop({
    min: 1,
    // max: 4, // Removed max limit
    default: 1,
  })
  currentInning: number;

  @Prop({
    min: 1,
    // max: 4, // Removed max limit
    default: 2,
  })
  totalInnings: number;

  @Prop({ min: 1 })
  dayNumber?: number;

  @Prop({ min: 1 })
  sessionNumber?: number;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  priority: number;

  @Prop({ default: 0 })
  superOverCount: number;

  @Prop({
    type: {
      tossText: { type: String, trim: true },
      winnerId: { type: Types.ObjectId, ref: 'Team' },
      elected: { type: String, enum: ['bat', 'bowl'] },
      tossTime: { type: Date },
    },
    default: null
  })
  toss?: {
    tossText?: string;
    winnerId?: Types.ObjectId;
    elected?: 'bat' | 'bowl';
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
    default: null
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
    default: null
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
    default: null
  })
  conditions?: {
    weather?: string;
    temperature?: string;
    humidity?: string;
    windSpeed?: string;
    pitchCondition?: string;
    pitchReport?: string;
  };

  @Prop({
    type: {
      team1Wins: { type: Number, default: 0 },
      team2Wins: { type: Number, default: 0 },
    },
    default: null
  })
  headToHead?: {
    team1Wins?: number;
    team2Wins?: number;
  };

  @Prop({
    type: {
      team1Form: { type: String, trim: true },
      team2Form: { type: String, trim: true },
    },
    default: null
  })
  teamForm?: {
    team1Form?: string;
    team2Form?: string;
  };

  @Prop({ default: false })
  drsAvailable: boolean;

  @Prop({
    default: 0,
    min: 0,
  })
  powerplayOvers: number;



  @Prop({ trim: true })
  pitchReport?: string;

  @Prop({
    enum: ['batting-friendly', 'bowling-friendly', 'balanced', 'spinning', 'seaming'],
    default: null,
  })
  pitchBehaviour?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  views: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy?: Types.ObjectId;

  // --- Fields moved from LiveMatchStatus ---

  // Odds fields
  @Prop({ type: String, default: '' })
  oddsTeam?: string;

  @Prop({ type: Number, default: 0 })
  oddsBlue?: number;

  @Prop({ type: Number, default: 0 })
  oddsRed?: number;

  @Prop({ type: Number, default: 0 })
  session?: number;

  @Prop({ type: Number, default: 0 })
  sessionBlue?: number;

  @Prop({ type: Number, default: 0 })
  sessionRed?: number;

  @Prop({ type: Number, default: 0 })
  lambi?: number;

  @Prop({ type: Number, default: 0 })
  lambiBlue?: number;

  @Prop({ type: Number, default: 0 })
  lambiRed?: number;

  // Status flags
  @Prop({ default: true })
  isMatchNew: boolean;

  @Prop({ default: false })
  noScorecards: boolean;

  @Prop({ default: false })
  viewMode: boolean;

  @Prop({ default: false })
  isNotShowing: boolean;

  @Prop({ default: false })
  dls: boolean;

  @Prop({ default: false })
  noCommentry: boolean;

  @Prop({ default: false })
  onOC: boolean;

  @Prop({ default: '' })
  comment2: string;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// Indexes
MatchSchema.index({ slug: 1 });
MatchSchema.index({ status: 1, matchDate: -1 });
MatchSchema.index({ tournamentId: 1, matchDate: -1 });
MatchSchema.index({ teamAId: 1, teamBId: 1, status: 1 });
MatchSchema.index({ seriesId: 1, matchDate: -1 });

