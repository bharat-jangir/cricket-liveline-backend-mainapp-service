import { IsMongoId, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFantasyStatsDto {
  @IsMongoId()
  @IsOptional()
  matchId?: string;

  @IsMongoId()
  @IsOptional()
  playerId?: string;

  @IsMongoId()
  @IsOptional()
  teamId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}

