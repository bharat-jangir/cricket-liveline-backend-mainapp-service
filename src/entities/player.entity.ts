import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerDocument = Player & Document;

@Schema({ timestamps: true })
export class Player {
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  name: string;

  @Prop({
    trim: true,
    maxlength: 150,
  })
  fullName?: string;

  @Prop({
    trim: true,
    maxlength: 100,
  })
  shortName?: string;

  @Prop({
    trim: true,
    maxlength: 100,
  })
  nickName?: string;

  @Prop({
    trim: true,
    maxlength: 100,
  })
  iccName?: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  slug: string;

  @Prop({ default: null })
  image?: string;

  @Prop({ default: null })
  coverImage?: string;

  @Prop()
  dob?: Date;

  @Prop()
  dod?: Date; // Date of Death

  @Prop({
    trim: true,
    maxlength: 100,
  })
  birthPlace?: string;

  @Prop({
    trim: true,
    maxlength: 7,
  })
  skinTone?: string; // Hex color code

  @Prop({
    required: true,
    trim: true,
  })
  country: string;

  @Prop({ trim: true })
  nationality?: string;

  @Prop({
    enum: ['male', 'female'],
    default: 'male',
  })
  gender?: string;

  @Prop({
    trim: true,
    maxlength: 10,
  })
  intlTeam?: string; // International team code (e.g., 'ind', 'aus')

  @Prop({
    trim: true,
    maxlength: 100,
  })
  playerFor?: string; // Country/Team the player represents

  @Prop({
    enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'],
    required: true,
  })
  role: string;

  @Prop({
    enum: ['right-hand', 'left-hand'],
    default: 'right-hand',
  })
  battingStyle: string;

  @Prop({ trim: true })
  bowlingStyle?: string;

  @Prop({
    enum: ['right', 'left'],
    default: 'right',
  })
  bowlingArm?: string;

  @Prop({ default: false })
  isMiddleOrder?: boolean;

  @Prop({
    min: 1,
    max: 99,
  })
  jerseyNumber?: number;

  @Prop({ trim: true })
  height?: string;

  @Prop({ maxlength: 2000 })
  bio?: string;

  @Prop({
    trim: true,
    maxlength: 200,
  })
  behaviour?: string;

  @Prop({
    trim: true,
    maxlength: 200,
  })
  signatureShot?: string;

  @Prop({
    trim: true,
    maxlength: 500,
  })
  website?: string;

  @Prop({
    type: Number,
    default: 0,
  })
  fantasyCredits?: number;

  @Prop({
    type: {
      test: { type: Date },
      odi: { type: Date },
      t20i: { type: Date },
      t20: { type: Date },
    },
    _id: false,
  })
  debut?: {
    test?: Date;
    odi?: Date;
    t20i?: Date;
    t20?: Date;
  };

  @Prop({
    type: [Types.ObjectId],
    ref: 'Team',
    default: [],
  })
  currentTeamIds: Types.ObjectId[];

  @Prop()
  retirementDate?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isRetired: boolean;

  @Prop({
    type: {
      twitter: { type: String, trim: true },
      instagram: { type: String, trim: true },
    },
    _id: false,
  })
  socialMedia?: {
    twitter?: string;
    instagram?: string;
  };
}

export const PlayerSchema = SchemaFactory.createForClass(Player);

// Indexes
PlayerSchema.index({ name: 1 });
PlayerSchema.index({ slug: 1 });
PlayerSchema.index({ country: 1 });
PlayerSchema.index({ role: 1, isActive: 1 });
PlayerSchema.index({ name: 'text', fullName: 'text' });

