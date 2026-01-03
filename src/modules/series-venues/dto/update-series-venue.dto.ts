import { IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class UpdateSeriesVenueDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priority?: number;
}

