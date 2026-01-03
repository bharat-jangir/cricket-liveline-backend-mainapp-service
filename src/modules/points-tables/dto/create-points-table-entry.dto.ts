import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsMongoId,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreatePointsTableEntryDto {
  @IsMongoId()
  @IsOptional()
  seriesId?: string;

  @IsMongoId()
  @IsOptional()
  tournamentId?: string;

  @IsMongoId()
  teamId: string;

  @IsEnum(['test', 'odi', 't20', 't20i'])
  @IsOptional()
  matchFormat?: string;

  @IsString()
  @IsOptional()
  groupName?: string;

  @IsNumber()
  @Min(1)
  position: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  played?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  won?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  lost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tied?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  draw?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  noResult?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;

  @IsNumber()
  @IsOptional()
  netRunRate?: number;

  @IsString()
  @IsOptional()
  for?: string;

  @IsString()
  @IsOptional()
  against?: string;

  @IsBoolean()
  @IsOptional()
  qualify?: boolean;

  @IsString()
  @IsOptional()
  teamFkey?: string;

  @IsEnum(['auto', 'manual'])
  @IsOptional()
  updateMode?: string;
}

