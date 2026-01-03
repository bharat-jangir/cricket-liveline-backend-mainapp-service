import {
  IsMongoId,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateFantasyStatsDto {
  @IsMongoId()
  @IsNotEmpty()
  matchId: string;

  @IsMongoId()
  @IsNotEmpty()
  playerId: string;

  @IsMongoId()
  @IsOptional()
  teamId?: string;

  @IsEnum(['wicket-keeper', 'batsman', 'all-rounder', 'bowler'])
  @IsNotEmpty()
  role: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  credits?: number;

  @IsBoolean()
  @IsOptional()
  isCaptain?: boolean;

  @IsBoolean()
  @IsOptional()
  isViceCaptain?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  runs?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  wickets?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  catches?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stumpings?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fours?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sixes?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maidens?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  economy?: number;

  @IsBoolean()
  @IsOptional()
  isManOfTheMatch?: boolean;

  @IsBoolean()
  @IsOptional()
  isPlaying?: boolean;
}

