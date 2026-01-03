import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminUserDocument = AdminUser & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AdminUser {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  userId: Types.ObjectId;

  @Prop({
    enum: ['super_admin', 'scorer', 'content_admin', 'moderator'],
    required: true,
  })
  role: string;

  @Prop({
    type: [String],
    enum: [
      'manage_matches', 'manage_content', 'view_analytics', 'manage_users',
      'manage_teams', 'manage_players', 'manage_tournaments', 'manage_venues',
      'manage_umpires', 'manage_experts', 'manage_notifications'
    ],
    default: [],
  })
  permissions: string[];

  @Prop({
    type: [Types.ObjectId],
    ref: 'Tournament',
    default: [],
  })
  assignedTournaments: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

// Indexes
AdminUserSchema.index({ userId: 1 });
AdminUserSchema.index({ role: 1, isActive: 1 });

