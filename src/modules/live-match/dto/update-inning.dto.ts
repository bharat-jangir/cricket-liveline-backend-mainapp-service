import { IsNotEmpty, IsNumber, IsString, IsMongoId, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class LastWicketDto {
  @IsString()
  name: string;

  @IsString()
  dismissal: string;

  @IsNumber()
  runs: number;

  @IsNumber()
  balls: number;

  @IsNumber()
  fours: number;

  @IsNumber()
  sixes: number;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  tr?: string | number;

  @IsMongoId()
  playerId: string;
}

export class UpdateInningDto {
  @IsOptional()
  @IsMongoId()
  battingTeamId?: string;

  @IsOptional()
  @IsMongoId()
  bowlingTeamId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalRuns?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  totalWickets?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalOvers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  runRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extras?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wides?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  noBalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  byes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  legByes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  penalties?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  target?: number;

  @IsOptional()
  @IsBoolean()
  isDeclared?: boolean;

  @IsOptional()
  @IsBoolean()
  isAllOut?: boolean;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  isFollowOn?: boolean;

  @IsOptional()
  @Type(() => Date)
  startTime?: Date;

  @IsOptional()
  @Type(() => Date)
  endTime?: Date;

  @IsOptional()
  @IsString()
  calculationMode?: 'auto' | 'manual'; // If manual, don't auto-calculate totals

  @IsOptional()
  @Type(() => LastWicketDto)
  lastWicket?: LastWicketDto;
}
