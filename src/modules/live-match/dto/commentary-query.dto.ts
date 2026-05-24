import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CommentaryQueryDto {
    @IsOptional()
    @IsString()
    inningId?: string;

    @IsOptional()
    @IsString()
    type?: 'all' | 'four' | 'six' | 'wicket' | 'maiden' | 'milestone' | 'over' | 'highlight';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;
}
