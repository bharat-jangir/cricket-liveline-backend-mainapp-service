import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { RequestLog, RequestLogSchema } from '../../entities/request-log.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RequestLog.name, schema: RequestLogSchema }]),
  ],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}

