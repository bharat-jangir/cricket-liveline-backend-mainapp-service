import { IsMongoId, IsOptional, IsBoolean, IsNumber, Min, IsNotEmpty } from 'class-validator';

export class AddVenueToSeriesDto {
  @IsMongoId()
  @IsNotEmpty()
  venueId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priority?: number;
}

