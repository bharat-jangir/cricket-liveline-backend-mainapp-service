import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SeriesVenuesService } from './series-venues.service';
import { AddVenueToSeriesDto } from './dto/add-venue-to-series.dto';
import { UpdateSeriesVenueDto } from './dto/update-series-venue.dto';
import { QuerySeriesVenuesDto } from './dto/query-series-venues.dto';

@Controller()
export class SeriesVenuesController {
  private readonly logger = new Logger(SeriesVenuesController.name);

  constructor(private readonly seriesVenuesService: SeriesVenuesService) {}

  @MessagePattern('series-venues.add')
  async addVenueToSeries(@Payload() payload: { seriesId: string; addVenueDto: AddVenueToSeriesDto }) {
    try {
      this.logger.debug(`Adding venue to series: ${payload.seriesId}`, JSON.stringify(payload.addVenueDto));
      const result = await this.seriesVenuesService.addVenueToSeries(payload.seriesId, payload.addVenueDto);
      
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in addVenueToSeries', error.stack || error.message || error);
      this.logger.error('Payload:', JSON.stringify(payload, null, 2));
      throw error;
    }
  }

  @MessagePattern('series-venues.findAll')
  async getSeriesVenues(@Payload() payload: { seriesId: string; query: QuerySeriesVenuesDto }) {
    try {
      const result = await this.seriesVenuesService.getSeriesVenues(payload.seriesId, payload.query);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in getSeriesVenues', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('series-venues.remove')
  async removeVenueFromSeries(@Payload() payload: { seriesId: string; venueId: string }) {
    try {
      const result = await this.seriesVenuesService.removeVenueFromSeries(payload.seriesId, payload.venueId);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in removeVenueFromSeries', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('series-venues.update')
  async updateSeriesVenue(@Payload() payload: { seriesId: string; venueId: string; updateDto: UpdateSeriesVenueDto }) {
    try {
      const result = await this.seriesVenuesService.updateSeriesVenue(payload.seriesId, payload.venueId, payload.updateDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateSeriesVenue', error.stack || error.message || error);
      throw error;
    }
  }
}

