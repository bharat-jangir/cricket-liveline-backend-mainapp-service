import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VenueStatsDocument = VenueStats & Document;

// Format-specific stats
class FormatStats {
  @Prop({ type: Number, default: 0 })
  matches?: number;

  @Prop({ type: Number, default: 0 })
  winBatFirst?: number;

  @Prop({ type: Number, default: 0 })
  winBowlFirst?: number;

  @Prop({ type: Number, default: 0 })
  avg1stInn?: number;

  @Prop({ type: Number, default: 0 })
  avg2ndInn?: number;

  @Prop({ type: Number, default: 0 })
  avg3rdInn?: number;

  @Prop({ type: Number, default: 0 })
  avg4thInn?: number;

  @Prop({ type: String })
  highestTotal?: string; // e.g., "450/3"

  @Prop({ type: Types.ObjectId, ref: 'Match' })
  highestTotalMatchId?: Types.ObjectId;

  @Prop({ type: String })
  lowestTotal?: string; // e.g., "58"

  @Prop({ type: Types.ObjectId, ref: 'Match' })
  lowestTotalMatchId?: Types.ObjectId;

  @Prop({ type: String })
  highestChased?: string; // e.g., "340/5"

  @Prop({ type: Types.ObjectId, ref: 'Match' })
  highestChasedMatchId?: Types.ObjectId;

  @Prop({ type: String })
  lowestDefended?: string; // e.g., "140"

  @Prop({ type: Types.ObjectId, ref: 'Match' })
  lowestDefendedMatchId?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class VenueStats {
  @Prop({
    type: Types.ObjectId,
    ref: 'Venue',
    required: true,
    unique: true,
  })
  venueId: Types.ObjectId;

  @Prop({
    type: {
      matches: { type: Number, default: 0 },
      winBatFirst: { type: Number, default: 0 },
      winBowlFirst: { type: Number, default: 0 },
      avg1stInn: { type: Number, default: 0 },
      avg2ndInn: { type: Number, default: 0 },
      avg3rdInn: { type: Number, default: 0 },
      avg4thInn: { type: Number, default: 0 },
      highestTotal: String,
      highestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestTotal: String,
      lowestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      highestChased: String,
      highestChasedMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestDefended: String,
      lowestDefendedMatchId: { type: Types.ObjectId, ref: 'Match' },
    },
    _id: false,
  })
  odi?: FormatStats;

  @Prop({
    type: {
      matches: { type: Number, default: 0 },
      winBatFirst: { type: Number, default: 0 },
      winBowlFirst: { type: Number, default: 0 },
      avg1stInn: { type: Number, default: 0 },
      avg2ndInn: { type: Number, default: 0 },
      avg3rdInn: { type: Number, default: 0 },
      avg4thInn: { type: Number, default: 0 },
      highestTotal: String,
      highestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestTotal: String,
      lowestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      highestChased: String,
      highestChasedMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestDefended: String,
      lowestDefendedMatchId: { type: Types.ObjectId, ref: 'Match' },
    },
    _id: false,
  })
  t20?: FormatStats;

  @Prop({
    type: {
      matches: { type: Number, default: 0 },
      winBatFirst: { type: Number, default: 0 },
      winBowlFirst: { type: Number, default: 0 },
      avg1stInn: { type: Number, default: 0 },
      avg2ndInn: { type: Number, default: 0 },
      avg3rdInn: { type: Number, default: 0 },
      avg4thInn: { type: Number, default: 0 },
      highestTotal: String,
      highestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestTotal: String,
      lowestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      highestChased: String,
      highestChasedMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestDefended: String,
      lowestDefendedMatchId: { type: Types.ObjectId, ref: 'Match' },
    },
    _id: false,
  })
  firstClass?: FormatStats;

  @Prop({
    type: {
      matches: { type: Number, default: 0 },
      winBatFirst: { type: Number, default: 0 },
      winBowlFirst: { type: Number, default: 0 },
      avg1stInn: { type: Number, default: 0 },
      avg2ndInn: { type: Number, default: 0 },
      avg3rdInn: { type: Number, default: 0 },
      avg4thInn: { type: Number, default: 0 },
      highestTotal: String,
      highestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestTotal: String,
      lowestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      highestChased: String,
      highestChasedMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestDefended: String,
      lowestDefendedMatchId: { type: Types.ObjectId, ref: 'Match' },
    },
    _id: false,
  })
  domesticT20?: FormatStats;

  @Prop({
    type: {
      matches: { type: Number, default: 0 },
      winBatFirst: { type: Number, default: 0 },
      winBowlFirst: { type: Number, default: 0 },
      avg1stInn: { type: Number, default: 0 },
      avg2ndInn: { type: Number, default: 0 },
      avg3rdInn: { type: Number, default: 0 },
      avg4thInn: { type: Number, default: 0 },
      highestTotal: String,
      highestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestTotal: String,
      lowestTotalMatchId: { type: Types.ObjectId, ref: 'Match' },
      highestChased: String,
      highestChasedMatchId: { type: Types.ObjectId, ref: 'Match' },
      lowestDefended: String,
      lowestDefendedMatchId: { type: Types.ObjectId, ref: 'Match' },
    },
    _id: false,
  })
  ipl?: FormatStats;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VenueStatsSchema = SchemaFactory.createForClass(VenueStats);


