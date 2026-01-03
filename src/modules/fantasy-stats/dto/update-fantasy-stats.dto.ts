import { PartialType } from '@nestjs/mapped-types';
import { CreateFantasyStatsDto } from './create-fantasy-stats.dto';

export class UpdateFantasyStatsDto extends PartialType(CreateFantasyStatsDto) {}

