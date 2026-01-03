import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormatStatsDto } from './format-stats.dto';

export class UpsertVenueStatsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FormatStatsDto)
  odi?: FormatStatsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatStatsDto)
  t20?: FormatStatsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatStatsDto)
  firstClass?: FormatStatsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatStatsDto)
  domesticT20?: FormatStatsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatStatsDto)
  ipl?: FormatStatsDto;
}

