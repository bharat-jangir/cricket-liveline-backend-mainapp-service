import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsEnum, 
  IsDate, 
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsArray,
  IsMongoId
} from 'class-validator';
import { Type } from 'class-transformer';

class DebutDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  test?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  odi?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  t20i?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  t20?: Date;
}

class SocialMediaDto {
  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  instagram?: string;
}

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iccName?: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dob?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dod?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  birthPlace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  skinTone?: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  intlTeam?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  playerFor?: string;

  @IsEnum(['batsman', 'bowler', 'all-rounder', 'wicket-keeper'])
  @IsNotEmpty()
  role: string;

  @IsEnum(['right-hand', 'left-hand'])
  @IsOptional()
  battingStyle?: string;

  @IsOptional()
  @IsString()
  bowlingStyle?: string;

  @IsOptional()
  @IsEnum(['right', 'left'])
  bowlingArm?: string;

  @IsOptional()
  @IsBoolean()
  isMiddleOrder?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99)
  jerseyNumber?: number;

  @IsOptional()
  @IsString()
  height?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  behaviour?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  signatureShot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsNumber()
  fantasyCredits?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DebutDto)
  debut?: DebutDto;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  currentTeamIds?: string[];

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  retirementDate?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isRetired?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialMediaDto)
  socialMedia?: SocialMediaDto;
}

