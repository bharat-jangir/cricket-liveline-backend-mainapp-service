import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FantasyStatsService } from './fantasy-stats.service';
import { FantasyStatsController } from './fantasy-stats.controller';
import { FantasyStats, FantasyStatsSchema } from '../../entities/fantasy-stats.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FantasyStats.name, schema: FantasyStatsSchema },
    ]),
  ],
  controllers: [FantasyStatsController],
  providers: [FantasyStatsService, ResponseService],
  exports: [FantasyStatsService],
})
export class FantasyStatsModule {}

