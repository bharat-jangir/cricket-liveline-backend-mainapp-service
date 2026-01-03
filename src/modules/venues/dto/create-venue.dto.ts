import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsObject,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  MinLength,
  IsMongoId,
} from 'class-validator';
import { Type, Exclude } from 'class-transformer';

class CoordinatesDto {
  @IsOptional()
  @IsMongoId()
  @Exclude({ toPlainOnly: true })
  _id?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

class AvgFirstInningsScoreDto {
  @IsOptional()
  @IsMongoId()
  @Exclude({ toPlainOnly: true })
  _id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  test?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  t20?: number;
}

class GroundDistancesDto {
  @IsOptional()
  @IsMongoId()
  @Exclude({ toPlainOnly: true })
  _id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  top?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topRight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  right?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bottomRight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bottom?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bottomLeft?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  left?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topLeft?: number;
}

class GroundDimensionsDto {
  @IsOptional()
  @IsMongoId()
  @Exclude({ toPlainOnly: true })
  _id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  topEndName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bottomEndName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GroundDistancesDto)
  distances?: GroundDistancesDto;
}

class PitchDescriptionDto {
  @IsOptional()
  @IsMongoId()
  @Exclude({ toPlainOnly: true })
  _id?: string;

  @IsOptional()
  @IsString()
  dusty?: string;

  @IsOptional()
  @IsString()
  green?: string;

  @IsOptional()
  @IsString()
  dead?: string;
}

export class CreateVenueDto {
  @IsOptional()
  @IsMongoId()
  @Exclude({ toPlainOnly: true })
  _id?: string;

  @IsOptional()
  @Exclude({ toPlainOnly: true })
  createdAt?: Date;

  @IsOptional()
  @Exclude({ toPlainOnly: true })
  updatedAt?: Date;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  country: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(1800)
  @Max(new Date().getFullYear())
  established?: number;

  @IsOptional()
  @IsNumber()
  @Min(1800)
  @Max(new Date().getFullYear())
  yearOfFirstMatch?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  knownAs?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  association?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsOptional()
  @IsEnum(['batting', 'bowling', 'balanced'])
  pitchType?: 'batting' | 'bowling' | 'balanced';

  @IsOptional()
  @IsEnum(['pace', 'spin'])
  suitedFor?: 'pace' | 'spin';

  @IsOptional()
  @ValidateNested()
  @Type(() => AvgFirstInningsScoreDto)
  avgFirstInningsScore?: AvgFirstInningsScoreDto;

  @IsOptional()
  @IsEnum(['small', 'medium', 'large'])
  groundSize?: 'small' | 'medium' | 'large';

  @IsOptional()
  @ValidateNested()
  @Type(() => GroundDimensionsDto)
  groundDimensions?: GroundDimensionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PitchDescriptionDto)
  pitchDescription?: PitchDescriptionDto;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

