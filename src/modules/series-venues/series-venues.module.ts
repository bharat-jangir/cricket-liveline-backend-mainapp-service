import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeriesVenuesService } from './series-venues.service';
import { SeriesVenuesController } from './series-venues.controller';
import { SeriesVenue, SeriesVenueSchema } from '../../entities/series-venue.entity';
import { Venue, VenueSchema } from '../../entities/venue.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeriesVenue.name, schema: SeriesVenueSchema },
      { name: Venue.name, schema: VenueSchema },
    ]),
  ],
  controllers: [SeriesVenuesController],
  providers: [SeriesVenuesService, ResponseService],
  exports: [SeriesVenuesService],
})
export class SeriesVenuesModule {}

