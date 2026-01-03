import { IsNotEmpty, IsMongoId } from 'class-validator';

export class SwitchTeamDto {
  @IsNotEmpty()
  @IsMongoId()
  battingTeamId: string;

  @IsNotEmpty()
  @IsMongoId()
  bowlingTeamId: string;
}

