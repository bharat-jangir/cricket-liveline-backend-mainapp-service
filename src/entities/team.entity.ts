import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Team extends Document {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, uppercase: true })
  shortName: string;

  @Prop({ required: true, trim: true, uppercase: true, unique: true })
  code: string;

  @Prop({ 
    required: true, 
    enum: ['international', 'franchise', 'domestic', 'associate'],
    default: 'international'
  })
  type: string;

  @Prop({ 
    enum: ['men', 'women'],
    default: 'men'
  })
  format: string;

  @Prop({ required: true, trim: true })
  country: string;

  // Fantasy and display names
  @Prop({ trim: true })
  fantasyName: string;

  @Prop({ trim: true, uppercase: true })
  fantasyShortName: string;

  // Colors and theme
  @Prop({ default: '#1E40AF' })
  colorCode: string;

  @Prop({ default: '#3B82F6' })
  upColor: string;

  @Prop({ default: false })
  brightTheme: boolean;

  // Images
  @Prop()
  logo: string;

  @Prop()
  coverImage: string;

  @Prop()
  jerseyLimited: string;

  @Prop()
  jerseyTest: string;

  // Multi-language support
  @Prop({ 
    type: Object,
    default: {}
  })
  translations: Record<string, { name: string; fantasyName?: string }>;

  // Team Bio
  @Prop({ type: String })
  bio: string;

  // Formats supported
  @Prop({ 
    type: {
      t20: { type: Boolean, default: false },
      odi: { type: Boolean, default: false },
      test: { type: Boolean, default: false },
      t10: { type: Boolean, default: false },
      hundred: { type: Boolean, default: false }
    },
    _id: false
  })
  formats: {
    t20: boolean;
    odi: boolean;
    test: boolean;
    t10: boolean;
    hundred: boolean;
  };

  // Team Type (same as type field, but for UI specific purposes)
  @Prop({ 
    enum: ['international', 'domestic', 'league'],
    default: 'international'
  })
  teamType: string;

  // Gender (same as format)
  @Prop({ 
    enum: ['men', 'women'],
    default: 'men'
  })
  gender: string;

  // Series Type
  @Prop()
  seriesType: string;

  // Captains for different formats
  @Prop({ 
    type: {
      odi: { type: Types.ObjectId, ref: 'Player' },
      t20: { type: Types.ObjectId, ref: 'Player' },
      t10: { type: Types.ObjectId, ref: 'Player' },
      test: { type: Types.ObjectId, ref: 'Player' },
      hundred: { type: Types.ObjectId, ref: 'Player' }
    },
    _id: false
  })
  captains: {
    odi?: Types.ObjectId;
    t20?: Types.ObjectId;
    t10?: Types.ObjectId;
    test?: Types.ObjectId;
    hundred?: Types.ObjectId;
  };

  // Owner and Board
  @Prop()
  owner: string;

  @Prop()
  board: string;

  // Active Period
  @Prop()
  activeFrom: Date;

  @Prop()
  activeTo: Date;

  // Tournaments
  @Prop()
  tournamentsWon: string;

  @Prop()
  tournamentsCaptains: string;

  // Existing legacy fields
  @Prop()
  founded: number;

  @Prop()
  homeGround: string;

  @Prop()
  captainId: string;

  @Prop()
  coachName: string;

  @Prop({ 
    type: {
      test: { type: Number },
      odi: { type: Number },
      t20i: { type: Number }
    },
    _id: false
  })
  ranking: {
    test?: number;
    odi?: number;
    t20i?: number;
  };

  @Prop({ 
    type: {
      twitter: { type: String },
      instagram: { type: String },
      facebook: { type: String }
    },
    _id: false
  })
  socialMedia: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

// Indexes
TeamSchema.index({ code: 1 }, { unique: true });
TeamSchema.index({ name: 1 });
TeamSchema.index({ shortName: 1 });
TeamSchema.index({ country: 1 });
TeamSchema.index({ type: 1 });
TeamSchema.index({ format: 1 });
