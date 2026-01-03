import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ErrorLogDocument = ErrorLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ErrorLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  userId?: Types.ObjectId;

  @Prop({
    enum: ['api_error', 'db_error', 'client_error', 'server_error'],
    required: true,
  })
  errorType: string;

  @Prop({ required: true })
  errorMessage: string;

  @Prop({ default: null })
  stackTrace?: string;

  @Prop({ trim: true })
  endpoint?: string;

  @Prop({
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    trim: true,
  })
  method?: string;

  @Prop({
    min: 100,
    max: 599,
  })
  statusCode?: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  requestData?: any;

  @Prop({ trim: true })
  userAgent?: string;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({
    required: true,
    default: Date.now,
  })
  timestamp: Date;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);

// Indexes
ErrorLogSchema.index({ errorType: 1, timestamp: -1 });
ErrorLogSchema.index({ userId: 1, timestamp: -1 });
ErrorLogSchema.index({ statusCode: 1, timestamp: -1 });

// TTL Index - expire after 30 days
ErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

