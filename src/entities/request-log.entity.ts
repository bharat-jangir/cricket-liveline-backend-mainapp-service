import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RequestLogDocument = RequestLog & Document;

@Schema({ timestamps: true })
export class RequestLog {
  // logoId will be the MongoDB _id, no need for separate field

  @Prop({ required: true })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop({ type: Object })
  query?: Record<string, any>;

  @Prop({ type: Object })
  body?: Record<string, any>;

  @Prop({ type: Object })
  params?: Record<string, any>;

  @Prop({ type: Object })
  headers?: Record<string, any>;

  @Prop({ required: true })
  statusCode: number;

  @Prop({ type: Object })
  response?: any;

  @Prop({ type: Object })
  responseHeaders?: Record<string, any>;

  @Prop()
  userMessage?: string;

  @Prop()
  userMessageCode?: string;

  @Prop()
  developerMessage?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  userId?: string;

  @Prop({ default: 0 })
  responseTime?: number; // in milliseconds

  @Prop({ type: Object })
  error?: {
    message?: string;
    stack?: string;
    code?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const RequestLogSchema = SchemaFactory.createForClass(RequestLog);

// Indexes
RequestLogSchema.index({ createdAt: -1 });
RequestLogSchema.index({ statusCode: 1 });
RequestLogSchema.index({ userMessageCode: 1 });
RequestLogSchema.index({ path: 1, method: 1 });
RequestLogSchema.index({ userId: 1 });

// TTL Index: expire after 7 days (7 * 24 * 60 * 60 = 604800 seconds)
RequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

