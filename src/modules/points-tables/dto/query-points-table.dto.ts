import { IsOptional, IsString, IsEnum, IsMongoId, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPointsTableDto {
  @IsOptional()
  @IsMongoId()
  seriesId?: string;

  @IsOptional()
  @IsMongoId()
  tournamentId?: string;

  @IsOptional()
  @IsEnum(['test', 'odi', 't20', 't20i'])
  matchFormat?: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 100;
}

