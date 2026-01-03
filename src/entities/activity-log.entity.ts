import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
  })
  userName: string;

  @Prop({
    enum: ['create', 'update', 'delete', 'publish', 'unpublish', 'approve', 'reject'],
    required: true,
  })
  action: string;

  @Prop({
    enum: [
      'match', 'ball', 'news', 'player', 'team', 'tournament', 'venue',
      'umpire', 'expert', 'user', 'notification', 'content'
    ],
    required: true,
  })
  entity: string;

  @Prop({
    type: Types.ObjectId,
    required: true,
  })
  entityId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  changes?: any;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({ trim: true })
  userAgent?: string;

  @Prop({
    required: true,
    default: Date.now,
  })
  timestamp: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// Indexes
ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
ActivityLogSchema.index({ action: 1, timestamp: -1 });

// TTL Index - expire after 180 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

