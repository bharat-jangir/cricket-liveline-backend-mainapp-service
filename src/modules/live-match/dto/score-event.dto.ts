import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';

export class ScoreEventDto {
    @IsString()
    @IsEnum(['RUN', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'WICKET', 'UNDO', 'OVER_END', 'SWAP_BATSMAN'])
    type: 'RUN' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'WICKET' | 'UNDO' | 'OVER_END' | 'SWAP_BATSMAN';

    @IsNumber()
    @IsOptional()
    runs?: number;

    @IsNumber()
    @IsOptional()
    extras?: number;

    @IsBoolean()
    @IsOptional()
    isBoundary?: boolean;

    @IsString()
    @IsOptional()
    wicketType?: string;

    @IsString()
    @IsOptional()
    playerId?: string;

    @IsNumber()
    @IsOptional()
    ballNumber?: number;

    @IsBoolean()
    @IsOptional()
    isComposite?: boolean;

    @IsString()
    @IsOptional()
    bowlerName?: string;

    @IsString()
    @IsOptional()
    batsmanName?: string;
}
