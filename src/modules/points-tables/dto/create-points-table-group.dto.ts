import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsMongoId,
  ArrayMinSize,
} from 'class-validator';

export class CreatePointsTableGroupDto {
  @IsString()
  groupName: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['test', 'odi', 't20', 't20i'], { each: true })
  formats: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  teamIds: string[];

  @IsEnum(['auto', 'manual'])
  @IsOptional()
  updateMode?: string;
}

