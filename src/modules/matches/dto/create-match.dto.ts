import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsNumber,
  IsMongoId,
  IsDate,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMatchDto {
  @IsString()
  @IsNotEmpty()
  matchNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  shortTitle: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsMongoId()
  tournamentId?: string;

  @IsOptional()
  @IsMongoId()
  seriesId?: string;

  @IsEnum(['international', 'domestic', 'league'])
  @IsNotEmpty()
  matchType: string;

  @IsEnum(['test', 'odi', 't20', 't20i'])
  @IsNotEmpty()
  matchFormat: string;

  @IsMongoId()
  @IsNotEmpty()
  teamAId: string;

  @IsMongoId()
  @IsNotEmpty()
  teamBId: string;

  @IsMongoId()
  @IsNotEmpty()
  venueId: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  matchDate: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  matchTime?: Date; // Timestamp for match time

  @IsOptional()
  @IsString()
  localTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'live', 'completed', 'abandoned', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['toss_pending', 'innings_break', 'tea', 'lunch', 'stumps', 'rain_delay', 'normal'])
  matchState?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  currentInning?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(4)
  totalInnings?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dayNumber?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  sessionNumber?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  views?: number;
}

