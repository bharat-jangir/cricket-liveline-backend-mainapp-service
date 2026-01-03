import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SeriesVenueDocument = SeriesVenue & Document;

@Schema({ timestamps: true })
export class SeriesVenue extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'Series',
    required: true,
  })
  seriesId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Venue',
    required: true,
  })
  venueId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ min: 0 })
  priority?: number; // For ordering venues (lower = higher priority)

  createdAt: Date;
  updatedAt: Date;
}

export const SeriesVenueSchema = SchemaFactory.createForClass(SeriesVenue);

// Compound index to ensure one venue per series
SeriesVenueSchema.index({ seriesId: 1, venueId: 1 }, { unique: true });

// Additional indexes for common queries
SeriesVenueSchema.index({ seriesId: 1, isActive: 1 }); // For filtering active venues
SeriesVenueSchema.index({ venueId: 1 }); // For venue-based queries
SeriesVenueSchema.index({ seriesId: 1, priority: 1 }); // For ordering by priority

