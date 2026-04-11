import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Series extends Document {
  // Core Fields
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  shortName: string;

  @Prop({ trim: true })
  fantasyName: string;

  @Prop({ trim: true })
  fantasyShortName: string;

  @Prop({ required: true, unique: true, uppercase: true })
  key: string; // Firebase key - unique identifier

  // Dates
  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  // Images
  @Prop()
  seriesImage: string;

  @Prop()
  featuredImage: string;

  // Classification
  @Prop({ 
    required: true,
    enum: ['International', 'Domestic', 'League', 'Women'],
    default: 'International'
  })
  seriesType: string;

  @Prop({ 
    required: true,
    enum: ['Male', 'Female'],
    default: 'Male'
  })
  gender: string;

  @Prop({ 
    required: true,
    enum: ['ODI', 'T20', 'Test', 'T10', '100B'],
    default: 'T20'
  })
  activeFormat: string; // Current active format

  // Formats supported in this series
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

  // Tournament Configuration
  @Prop()
  tournamentType: string; // knockout | league | bilateral

  @Prop()
  bracketType: string;

  @Prop({ type: Number, default: 0 })
  drsSystem: number; // 0-2

  // Configuration Flags
  @Prop({ default: false })
  dontShowOnApp: boolean;

  @Prop({ default: false })
  toursOnlyTwoTeams: boolean; // IS TOUR - only two teams

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  onHome: boolean; // Show on OneCricket Home

  @Prop({ default: false })
  allowSquadMultiple: boolean; // Allow player in multiple teams

  // Associations (References to other entities)
  @Prop({ type: Types.ObjectId, ref: 'Notification' })
  defaultNotification: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Broadcaster' })
  broadcaster: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team' })
  hostTeam: Types.ObjectId;

  // Status (can be auto-calculated based on dates)
  @Prop({ 
    enum: ['Running', 'Finished', 'Upcoming', 'Scheduled'],
    default: 'Scheduled'
  })
  status: string;

  // Auto-calculated fields
  @Prop()
  year: number; // Extracted from startDate

  @Prop({ 
    enum: ['International', 'Domestic', 'League'],
    default: 'International'
  })
  category: string; // Can be derived from seriesType

  // Notification Flags
  @Prop({ default: false })
  oddsNotification: boolean;

  @Prop({ default: false })
  perNotification: boolean;

  // Stats (calculated from related data)
  @Prop({ type: Number, default: 0 })
  totalTeams: number;

  @Prop({ type: Number, default: 0 })
  totalMatches: number;

  // Feature flags for UI
  @Prop({ default: false })
  hasSquad: boolean;

  @Prop({ default: false })
  hasFixtures: boolean;

  @Prop({ default: false })
  hasPoints: boolean;

  @Prop({ default: false })
  recentlyOpened: boolean; // For UI sorting

  // Active status
  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const SeriesSchema = SchemaFactory.createForClass(Series);


SeriesSchema.index({ name: 1 });
SeriesSchema.index({ shortName: 1 });
SeriesSchema.index({ seriesType: 1 });
SeriesSchema.index({ status: 1 });
SeriesSchema.index({ startDate: 1 });
SeriesSchema.index({ endDate: 1 });
SeriesSchema.index({ year: 1 });
SeriesSchema.index({ isFeatured: 1 });

// Pre-save middleware to auto-calculate year and category
SeriesSchema.pre('save', function(next) {
  if (this.startDate) {
    this.year = new Date(this.startDate).getFullYear();
  }
  
  // Map seriesType to category
  if (this.seriesType === 'International' || this.seriesType === 'Women') {
    this.category = 'International';
  } else if (this.seriesType === 'Domestic') {
    this.category = 'Domestic';
  } else if (this.seriesType === 'League') {
    this.category = 'League';
  }
  
  next();
});
