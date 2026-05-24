import { IsString, IsOptional, IsNumber, IsEnum, IsMongoId } from 'class-validator';

export class UpdateRankingDto {
  @IsOptional()
  @IsMongoId()
  playerId?: string;

  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @IsOptional()
  @IsEnum(['men', 'women'])
  gender?: 'men' | 'women';

  @IsOptional()
  @IsEnum(['test', 'odi', 't20', 't10', 'hundred'])
  format?: 'test' | 'odi' | 't20' | 't10' | 'hundred';

  @IsOptional()
  @IsEnum(['batsman', 'bowler', 'allrounder'])
  role?: 'batsman' | 'bowler' | 'allrounder';

  @IsOptional()
  @IsNumber()
  points?: number;

  @IsOptional()
  @IsNumber()
  rank?: number;
}
