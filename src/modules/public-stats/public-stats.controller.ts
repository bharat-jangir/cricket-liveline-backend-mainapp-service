import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PublicStatsService } from './public-stats.service';

@Controller()
export class PublicStatsController {
  constructor(private readonly stats: PublicStatsService) {}

  @MessagePattern('players.stats')
  playerStats(@Payload() p: { playerId: string; format?: string }) {
    return this.stats.playerStats(p?.playerId, p?.format);
  }

  @MessagePattern('series.leaders')
  seriesLeaders(@Payload() seriesId: string) {
    return this.stats.seriesLeaders(seriesId);
  }
}
