import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  })
  email: string;

  @Prop({
    unique: true,
    sparse: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number'],
  })
  phone?: string;

  @Prop({
    required: true,
    select: false,
    minlength: 6,
  })
  password: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  name: string;

  @Prop({ default: null })
  avatar?: string;

  @Prop({
    enum: ['user', 'admin', 'super_admin', 'scorer', 'content_admin'],
    default: 'user',
  })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop({ default: null })
  lastLogin?: Date;

  @Prop({ default: 0 })
  loginCount: number;

  @Prop({
    type: [String],
    validate: {
      validator: (v: string[]) => v.length <= 5,
      message: 'Device tokens cannot exceed 5',
    },
    default: [],
  })
  deviceTokens: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ phone: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

