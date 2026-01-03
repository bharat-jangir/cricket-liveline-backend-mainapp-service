import { IsNotEmpty, IsNumber, IsString, IsMongoId, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLiveStatusDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  currentInning?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentOver?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  currentBall?: number;

  @IsOptional()
  @IsMongoId()
  battingTeamId?: string;

  @IsOptional()
  @IsMongoId()
  bowlingTeamId?: string;

  @IsOptional()
  @IsString()
  score?: string; // Format: "runs/wickets"

  @IsOptional()
  @IsString()
  overs?: string; // Format: "overs.balls"

  @IsOptional()
  @IsNumber()
  @Min(0)
  balls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  runRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  requiredRunRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  target?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ballsRemaining?: number;

  // Odds fields
  @IsOptional()
  @IsString()
  oddsTeam?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oddsBlue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oddsRed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  session?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionBlue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionRed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lambi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lambiBlue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lambiRed?: number;

  @IsOptional()
  powerPlay?: boolean;

  @IsOptional()
  isNew?: boolean;

  @IsOptional()
  noScorecards?: boolean;

  @IsOptional()
  viewMode?: boolean;

  @IsOptional()
  isNotShowing?: boolean;

  @IsOptional()
  dls?: boolean;

  @IsOptional()
  noCommentry?: boolean;

  @IsOptional()
  onOC?: boolean;

  @IsOptional()
  @IsString()
  comment2?: string;

  @IsOptional()
  @IsString()
  comment3?: string;
}

