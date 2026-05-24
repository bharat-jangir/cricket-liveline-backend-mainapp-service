import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsMongoId } from 'class-validator';

export class CreateRankingDto {
  @IsOptional()
  @IsMongoId()
  playerId?: string;

  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @IsEnum(['men', 'women'])
  gender: 'men' | 'women';

  @IsEnum(['test', 'odi', 't20', 't10', 'hundred'])
  format: 'test' | 'odi' | 't20' | 't10' | 'hundred';

  @IsEnum(['batsman', 'bowler', 'allrounder'])
  role: 'batsman' | 'bowler' | 'allrounder';

  @IsNumber()
  points: number;

  @IsNumber()
  rank: number;
}
