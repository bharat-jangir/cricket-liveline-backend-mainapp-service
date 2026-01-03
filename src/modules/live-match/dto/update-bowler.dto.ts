import { IsNotEmpty, IsNumber, IsString, IsMongoId, IsOptional, Min, IsIn, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBowlerDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  overs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  completedOvers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maidens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  runs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wickets?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  noBalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wides?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  bowlingOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dots?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sixes?: number;

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'manual'])
  calculationMode?: 'auto' | 'manual'; // If manual, don't auto-calculate economy, strikeRate, average

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean; // Whether this player is visible in the scorecard
}

