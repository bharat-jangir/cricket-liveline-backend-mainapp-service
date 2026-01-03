import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { VenueStatsService } from './venue-stats.service';
import { UpsertVenueStatsDto } from './dto/upsert-venue-stats.dto';

@Controller()
export class VenueStatsController {
  private readonly logger = new Logger(VenueStatsController.name);

  constructor(private readonly venueStatsService: VenueStatsService) {}

  @MessagePattern('venue-stats.get')
  async getStats(@Payload() venueId: string) {
    this.logger.log(`Received request to get stats for venue: ${venueId}`);
    const result = await this.venueStatsService.getStatsByVenueId(venueId);
    return result.response;
  }

  @MessagePattern('venue-stats.upsert')
  async upsertStats(@Payload() payload: { venueId: string; dto: UpsertVenueStatsDto }) {
    this.logger.log(`Received request to upsert stats for venue: ${payload.venueId}`);
    const result = await this.venueStatsService.upsertStats(payload.venueId, payload.dto);
    return result.response;
  }
}

