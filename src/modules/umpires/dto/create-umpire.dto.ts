import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsBoolean,
  IsMongoId,
} from 'class-validator';

export class CreateUmpireDto {
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  height?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  testMatches?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odiMatches?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  t20Matches?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherMatches?: number;

  @IsOptional()
  @IsString()
  careerStart?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  createdAt?: Date;

  @IsOptional()
  updatedAt?: Date;
}

