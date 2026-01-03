import { IsNotEmpty, IsString, IsMongoId, IsEnum, IsOptional, IsBoolean, ValidateNested, IsArray, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SquadPlayerDto {
  @IsMongoId()
  @IsNotEmpty()
  playerId: string;

  @IsOptional()
  @IsBoolean()
  isCaptain?: boolean;

  @IsOptional()
  @IsBoolean()
  isViceCaptain?: boolean;

  @IsOptional()
  @IsBoolean()
  isWicketKeeper?: boolean;

  @IsOptional()
  @IsBoolean()
  isNotEligible?: boolean;

  @IsOptional()
  @IsEnum(['Batter', 'Bowler', 'All-Rounder', 'Wicket Keeper'])
  role?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99)
  jerseyNumber?: number;
}

export class AddTeamToSeriesDto {
  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  @IsEnum(['ODI', 'T20', 'Test', 'T10', '100B'])
  @IsNotEmpty()
  format: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsBoolean()
  copyFromTeamRoster?: boolean; // If true, copy players from PlayerTeam
}

export class UpdateSquadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SquadPlayerDto)
  squadPlayers: SquadPlayerDto[];
}

export class QuerySeriesTeamsDto {
  @IsOptional()
  @IsEnum(['ODI', 'T20', 'Test', 'T10', '100B'])
  format?: string;

  @IsOptional()
  @IsString()
  groupName?: string;
}

