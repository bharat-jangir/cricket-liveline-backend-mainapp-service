import { PartialType } from '@nestjs/mapped-types';
import { CreateUmpireDto } from './create-umpire.dto';

export class UpdateUmpireDto extends PartialType(CreateUmpireDto) {}

