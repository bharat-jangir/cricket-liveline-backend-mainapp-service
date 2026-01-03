import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFantasyStatsDto } from './create-fantasy-stats.dto';

export class BulkCreateFantasyStatsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFantasyStatsDto)
  stats: CreateFantasyStatsDto[];
}

