import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VenueDocument = Venue & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Venue {
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  name: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  city: string;

  @Prop({
    trim: true,
    maxlength: 50,
  })
  state?: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  country: string;

  @Prop({ min: 0 })
  capacity?: number;

  @Prop({
    min: 1800,
    max: new Date().getFullYear(),
  })
  established?: number;

  @Prop({
    trim: true,
    maxlength: 100,
  })
  knownAs?: string;

  @Prop({ default: null })
  image?: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({
    type: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    _id: false, // Disable _id for nested object
  })
  coordinates?: {
    lat?: number;
    lng?: number;
  };

  @Prop({
    enum: ['batting', 'bowling', 'balanced'],
    default: 'balanced',
  })
  pitchType: string;

  @Prop({
    enum: ['pace', 'spin'],
  })
  suitedFor?: string;

  @Prop({
    type: {
      test: { type: Number, min: 0 },
      odi: { type: Number, min: 0 },
      t20: { type: Number, min: 0 },
    },
    _id: false, // Disable _id for nested object
  })
  avgFirstInningsScore?: {
    test?: number;
    odi?: number;
    t20?: number;
  };

  @Prop({ default: true })
  isActive: boolean;

  // Additional fields from frontend
  @Prop({
    min: 1800,
    max: new Date().getFullYear(),
  })
  yearOfFirstMatch?: number;

  @Prop({
    trim: true,
    maxlength: 100,
  })
  association?: string;

  @Prop({
    type: String,
  })
  bio?: string;

  @Prop({
    enum: ['small', 'medium', 'large'],
  })
  groundSize?: string;

  @Prop({
    type: {
      topEndName: String,
      bottomEndName: String,
      distances: {
        type: {
          top: Number,
          topRight: Number,
          right: Number,
          bottomRight: Number,
          bottom: Number,
          bottomLeft: Number,
          left: Number,
          topLeft: Number,
        },
        _id: false, // Disable _id for nested distances object
      },
    },
    _id: false, // Disable _id for groundDimensions object
  })
  groundDimensions?: {
    topEndName?: string;
    bottomEndName?: string;
    distances?: {
      top?: number;
      topRight?: number;
      right?: number;
      bottomRight?: number;
      bottom?: number;
      bottomLeft?: number;
      left?: number;
      topLeft?: number;
    };
  };

  @Prop({
    type: {
      dusty: String,
      green: String,
      dead: String,
    },
    _id: false, // Disable _id for nested object
  })
  pitchDescription?: {
    dusty?: string;
    green?: string;
    dead?: string;
  };
}

export const VenueSchema = SchemaFactory.createForClass(Venue);

// Indexes
VenueSchema.index({ name: 1 });
VenueSchema.index({ city: 1 });
VenueSchema.index({ country: 1 });
VenueSchema.index({ name: 'text' });

