import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VenueStats, VenueStatsSchema } from '../../entities/venue-stats.entity';
import { VenueStatsService } from './venue-stats.service';
import { VenueStatsController } from './venue-stats.controller';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VenueStats.name, schema: VenueStatsSchema },
    ]),
  ],
  controllers: [VenueStatsController],
  providers: [VenueStatsService, ResponseService],
  exports: [VenueStatsService],
})
export class VenueStatsModule {}

