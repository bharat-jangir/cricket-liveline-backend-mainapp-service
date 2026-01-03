import { IsOptional, IsNumber, IsString, Min, IsMongoId } from 'class-validator';

export class FormatStatsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  matches?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  winBatFirst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  winBowlFirst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  avg1stInn?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  avg2ndInn?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  avg3rdInn?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  avg4thInn?: number;

  @IsOptional()
  @IsString()
  highestTotal?: string;

  @IsOptional()
  @IsMongoId()
  highestTotalMatchId?: string;

  @IsOptional()
  @IsString()
  lowestTotal?: string;

  @IsOptional()
  @IsMongoId()
  lowestTotalMatchId?: string;

  @IsOptional()
  @IsString()
  highestChased?: string;

  @IsOptional()
  @IsMongoId()
  highestChasedMatchId?: string;

  @IsOptional()
  @IsString()
  lowestDefended?: string;

  @IsOptional()
  @IsMongoId()
  lowestDefendedMatchId?: string;
}

