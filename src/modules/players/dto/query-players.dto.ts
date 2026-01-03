import { IsOptional, IsString, IsEnum, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPlayersDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by name, fullName

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(['batsman', 'bowler', 'all-rounder', 'wicket-keeper'])
  role?: string;

  @IsOptional()
  @IsEnum(['right-hand', 'left-hand'])
  battingStyle?: string;

  @IsOptional()
  @IsString()
  teamId?: string; // Filter by team

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRetired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

