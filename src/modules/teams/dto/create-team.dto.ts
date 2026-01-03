import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsObject, 
  IsNumber,
  IsMongoId,
  IsDate,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';

class TranslationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  fantasyName?: string;
}

class FormatsDto {
  @IsOptional()
  @IsBoolean()
  t20?: boolean;

  @IsOptional()
  @IsBoolean()
  odi?: boolean;

  @IsOptional()
  @IsBoolean()
  test?: boolean;

  @IsOptional()
  @IsBoolean()
  t10?: boolean;

  @IsOptional()
  @IsBoolean()
  hundred?: boolean;
}

class CaptainsDto {
  @IsOptional()
  @ValidateIf((o) => o.odi !== '' && o.odi !== null)
  @IsMongoId()
  odi?: string;

  @IsOptional()
  @ValidateIf((o) => o.t20 !== '' && o.t20 !== null)
  @IsMongoId()
  t20?: string;

  @IsOptional()
  @ValidateIf((o) => o.t10 !== '' && o.t10 !== null)
  @IsMongoId()
  t10?: string;

  @IsOptional()
  @ValidateIf((o) => o.test !== '' && o.test !== null)
  @IsMongoId()
  test?: string;

  @IsOptional()
  @ValidateIf((o) => o.hundred !== '' && o.hundred !== null)
  @IsMongoId()
  hundred?: string;
}

class RankingDto {
  @IsOptional()
  @IsNumber()
  test?: number;

  @IsOptional()
  @IsNumber()
  odi?: number;

  @IsOptional()
  @IsNumber()
  t20i?: number;
}

class SocialMediaDto {
  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  facebook?: string;
}

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  shortName: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(['international', 'franchise', 'domestic', 'associate'])
  type: string;

  @IsOptional()
  @IsEnum(['men', 'women'])
  format?: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsString()
  fantasyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  fantasyShortName?: string;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  @IsString()
  upColor?: string;

  @IsOptional()
  @IsBoolean()
  brightTheme?: boolean;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  jerseyLimited?: string;

  @IsOptional()
  @IsString()
  jerseyTest?: string;

  @IsOptional()
  @IsObject()
  translations?: Record<string, { name: string; fantasyName?: string }>;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatsDto)
  formats?: FormatsDto;

  @IsOptional()
  @IsEnum(['international', 'domestic', 'league'])
  teamType?: string;

  @IsOptional()
  @IsEnum(['men', 'women'])
  gender?: string;

  @IsOptional()
  @IsString()
  seriesType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CaptainsDto)
  captains?: CaptainsDto;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  board?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  activeFrom?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  activeTo?: Date;

  @IsOptional()
  @IsString()
  tournamentsWon?: string;

  @IsOptional()
  @IsString()
  tournamentsCaptains?: string;

  @IsOptional()
  @IsNumber()
  founded?: number;

  @IsOptional()
  @IsString()
  homeGround?: string;

  @IsOptional()
  @IsString()
  captainId?: string;

  @IsOptional()
  @IsString()
  coachName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RankingDto)
  ranking?: RankingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialMediaDto)
  socialMedia?: SocialMediaDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Allow these fields for backward compatibility
  @IsOptional()
  @IsMongoId()
  _id?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  updatedAt?: Date;
}

