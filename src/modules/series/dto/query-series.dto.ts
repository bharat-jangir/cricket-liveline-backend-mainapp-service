import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QuerySeriesDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by name, shortName, fantasyName

  @IsOptional()
  @IsEnum(['International', 'Domestic', 'League', 'Women'])
  seriesType?: string;

  @IsOptional()
  @IsString()
  category?: string; // Can be a single category or comma-separated

  @IsOptional()
  @IsString()
  format?: string; // Can be a single format or comma-separated

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  status?: string; // Can be a single status or comma-separated

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  onHome?: boolean;

  @IsOptional()
  @IsString()
  team?: string; // MongoDB ID - filter series by team (will check SeriesTeam)

  @IsOptional()
  @IsString()
  startDateFrom?: string; // ISO date string

  @IsOptional()
  @IsString()
  startDateTo?: string; // ISO date string

  @IsOptional()
  @IsString()
  endDateFrom?: string;

  @IsOptional()
  @IsString()
  endDateTo?: string;

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

