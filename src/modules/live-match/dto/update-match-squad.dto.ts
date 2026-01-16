import { IsNotEmpty, IsArray, IsMongoId, IsOptional, ArrayMinSize, ArrayMaxSize, ValidateIf } from 'class-validator';
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
  @ValidateIf((o, v) => v !== null)
  @IsMongoId()
  captainId?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsMongoId()
  viceCaptainId?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsMongoId()
  wicketKeeperId?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsMongoId()
  impactPlayerId?: string | null;
}

