import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsNumber,
  IsMongoId,
  IsDate,
  ValidateNested,
  IsNotEmpty,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreateSeriesDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  shortName: string;

  @IsOptional()
  @IsString()
  fantasyName?: string;

  @IsOptional()
  @IsString()
  fantasyShortName?: string;

  @IsString()
  @IsNotEmpty()
  key: string; // Firebase key - unique

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsOptional()
  @IsString()
  seriesImage?: string;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @IsEnum(['International', 'Domestic', 'League', 'Women'])
  seriesType: string;

  @IsEnum(['Male', 'Female'])
  gender: string;

  @IsEnum(['ODI', 'T20', 'Test', 'T10', '100B'])
  activeFormat: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatsDto)
  formats?: FormatsDto;

  @IsOptional()
  @IsString()
  tournamentType?: string;

  @IsOptional()
  @IsString()
  bracketType?: string;

  @IsOptional()
  @IsNumber()
  drsSystem?: number;

  @IsOptional()
  @IsBoolean()
  dontShowOnApp?: boolean;

  @IsOptional()
  @IsBoolean()
  toursOnlyTwoTeams?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  onHome?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSquadMultiple?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.defaultNotification !== '' && o.defaultNotification !== null)
  @IsMongoId()
  defaultNotification?: string;

  @IsOptional()
  @ValidateIf((o) => o.broadcaster !== '' && o.broadcaster !== null)
  @IsMongoId()
  broadcaster?: string;

  @IsOptional()
  @ValidateIf((o) => o.hostTeam !== '' && o.hostTeam !== null)
  @IsMongoId()
  hostTeam?: string;

  @IsOptional()
  @IsEnum(['Running', 'Finished', 'Upcoming', 'Scheduled'])
  status?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsEnum(['International', 'Domestic', 'League'])
  category?: string;

  @IsOptional()
  @IsBoolean()
  oddsNotification?: boolean;

  @IsOptional()
  @IsBoolean()
  perNotification?: boolean;

  @IsOptional()
  @IsNumber()
  totalTeams?: number;

  @IsOptional()
  @IsNumber()
  totalMatches?: number;

  @IsOptional()
  @IsBoolean()
  hasSquad?: boolean;

  @IsOptional()
  @IsBoolean()
  hasFixtures?: boolean;

  @IsOptional()
  @IsBoolean()
  hasPoints?: boolean;

  @IsOptional()
  @IsBoolean()
  recentlyOpened?: boolean;

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

