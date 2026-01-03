import { IsOptional, IsString, IsBoolean, IsMongoId } from 'class-validator';

export class QuerySeriesVenuesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsMongoId()
  venueId?: string;
}

