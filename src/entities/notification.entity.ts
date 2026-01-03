import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null, // null for broadcast notifications
  })
  userId?: Types.ObjectId;

  @Prop({
    enum: [
      'match_start', 'match_end', 'wicket', 'boundary', 'milestone',
      'news', 'video', 'expert_analysis', 'poll', 'award'
    ],
    required: true,
  })
  type: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 500,
  })
  message: string;

  @Prop({
    matchId: { type: Types.ObjectId, ref: 'Match', default: null },
    teamId: { type: Types.ObjectId, ref: 'Team', default: null },
    playerId: { type: Types.ObjectId, ref: 'Player', default: null },
    newsId: { type: Types.ObjectId, ref: 'News', default: null },
    videoId: { type: Types.ObjectId, ref: 'Video', default: null },
  })
  data?: {
    matchId?: Types.ObjectId;
    teamId?: Types.ObjectId;
    playerId?: Types.ObjectId;
    newsId?: Types.ObjectId;
    videoId?: Types.ObjectId;
  };

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: false })
  isSent: boolean;

  @Prop({ default: null })
  sentAt?: Date;

  @Prop({ default: null })
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Compound indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ 'data.matchId': 1, createdAt: -1 });

// TTL Index - expire after 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

