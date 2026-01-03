import { IsNotEmpty, IsArray, IsMongoId, IsOptional, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMatchSquadDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(11)
  @ArrayMaxSize(11)
  @IsMongoId({ each: true })
  playingXI?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  bench?: string[];

  @IsOptional()
  @IsMongoId()
  captainId?: string;

  @IsOptional()
  @IsMongoId()
  viceCaptainId?: string;

  @IsOptional()
  @IsMongoId()
  wicketKeeperId?: string;
}

