import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type OverSummaryDocument = OverSummary & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class OverSummary {
  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Inning',
    required: true,
  })
  inningId: Types.ObjectId;

  @Prop({
    required: true,
    min: 1,
  })
  overNumber: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    required: true,
  })
  bowlerId: Types.ObjectId;

  @Prop({
    default: 0,
    min: 0,
  })
  runs: number;

  @Prop({
    default: 0,
    min: 0,
    max: 10,
  })
  wickets: number;

  @Prop({
    default: 0,
    min: 0,
  })
  extras: number;

  @Prop({
    type: [MongooseSchema.Types.Mixed],
    validate: {
      validator: (v: any[]) => v.length <= 15, // Increased slightly to accommodate common extra balls
      message: 'Balls data cannot exceed 15',
    },
  })
  ballsData?: {
    ballId: Types.ObjectId;
    ballLabel: string;
    commentary: string;
    shortText?: string;
    isLegal: boolean;
    type: 'ball' | 'wicket' | 'milestone' | 'over_end' | 'innings_summary';

    // Player Information
    bowlerId?: Types.ObjectId;
    bowlerName?: string;
    batsmanId?: Types.ObjectId;
    batsmanName?: string;

    // Live Status at Ball Time
    odds?: {
      team1Odds?: number;
      team2Odds?: number;
    };
    session?: {
      sessionName?: string;
      sessionValue?: number;
      sessionBlue?: number;
      sessionRed?: number;
    };
    lambi?: {
      lambiValue?: number;
      lambiBlue?: number;
      lambiRed?: number;
    };

    highlightData?: any;
    displayTheme?: string;
    timestamp: Date;
  }[];

  @Prop({ default: false })
  isMaiden: boolean;
}

export const OverSummarySchema = SchemaFactory.createForClass(OverSummary);

// Compound indexes
OverSummarySchema.index({ matchId: 1, inningId: 1, overNumber: 1 }, { unique: true });

