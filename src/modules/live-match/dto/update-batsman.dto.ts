import { IsNotEmpty, IsNumber, IsString, IsMongoId, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBatsmanDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  runs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sixes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(11)
  battingPosition?: number;

  @IsOptional()
  @IsBoolean()
  isOut?: boolean;

  @IsOptional()
  @IsBoolean()
  isRetiredHurt?: boolean;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsString()
  dismissalType?: 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'not_out' | 'retired_hurt' | 'absent';

  @IsOptional()
  @IsMongoId()
  bowlerId?: string;

  @IsOptional()
  @IsMongoId()
  fielderId?: string;

  @IsOptional()
  @IsMongoId()
  fielder2Id?: string;

  @IsOptional()
  @IsString()
  dismissalText?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dots?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ones?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  twos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  threes?: number;

  @IsOptional()
  @IsBoolean()
  isOnStrike?: boolean;

  @IsOptional()
  @IsBoolean()
  calculationMode?: 'auto' | 'manual'; // If manual, don't auto-calculate strikeRate

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean; // Whether this player is visible in the scorecard

  @IsOptional()
  @IsString()
  to?: string; // This Over - runs scored in current over

  @IsOptional()
  tr?: string | number; // Total Runs or other custom field
}

