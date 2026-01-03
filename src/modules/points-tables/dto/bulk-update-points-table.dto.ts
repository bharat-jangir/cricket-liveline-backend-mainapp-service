import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdatePointsTableEntryDto } from './update-points-table-entry.dto';

export class BulkUpdatePointsTableDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePointsTableEntryDto)
  entries: UpdatePointsTableEntryDto[];
}

