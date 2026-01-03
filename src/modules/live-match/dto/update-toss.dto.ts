import { IsNotEmpty, IsString, IsMongoId, IsIn } from 'class-validator';

export class UpdateTossDto {
  @IsNotEmpty()
  @IsString()
  tossText: string;

  @IsNotEmpty()
  @IsMongoId()
  winnerId: string;

  @IsNotEmpty()
  @IsIn(['bat', 'bowl'])
  elected: 'bat' | 'bowl';
}

