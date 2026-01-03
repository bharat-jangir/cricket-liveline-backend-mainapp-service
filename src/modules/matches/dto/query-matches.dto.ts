import { IsOptional, IsString, IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMatchesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsMongoId()
  seriesId?: string;

  @IsOptional()
  @IsMongoId()
  tournamentId?: string;

  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @IsOptional()
  @IsMongoId()
  venueId?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'live', 'completed', 'abandoned', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['test', 'odi', 't20', 't20i'])
  matchFormat?: string;

  @IsOptional()
  @IsEnum(['international', 'domestic', 'league'])
  matchType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

