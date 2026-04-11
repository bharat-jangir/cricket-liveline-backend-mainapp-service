import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type SystemSettingDocument = SystemSetting & Document;

@Schema({ timestamps: true })
export class SystemSetting {
  @Prop({
    required: true,
    unique: true,
    trim: true,
  })
  key: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
  })
  value: any;

  @Prop({
    trim: true,
    maxlength: 500,
  })
  description?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  updatedBy?: Types.ObjectId;
}

export const SystemSettingSchema = SchemaFactory.createForClass(SystemSetting);

// Indexes


