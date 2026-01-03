import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Umpire, UmpireSchema } from '../../entities/umpire.entity';
import { UmpiresService } from './umpires.service';
import { UmpiresController } from './umpires.controller';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Umpire.name, schema: UmpireSchema }]),
  ],
  controllers: [UmpiresController],
  providers: [UmpiresService, ResponseService],
  exports: [UmpiresService],
})
export class UmpiresModule {}

