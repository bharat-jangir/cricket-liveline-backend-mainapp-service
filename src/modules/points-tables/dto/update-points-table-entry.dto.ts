import { PartialType } from '@nestjs/mapped-types';
import { IsMongoId, IsOptional } from 'class-validator';
import { Expose } from 'class-transformer';
import { CreatePointsTableEntryDto } from './create-points-table-entry.dto';

export class UpdatePointsTableEntryDto extends PartialType(CreatePointsTableEntryDto) {
  @Expose()
  @IsOptional()
  @IsMongoId()
  _id?: string; // For bulk update identification
}

