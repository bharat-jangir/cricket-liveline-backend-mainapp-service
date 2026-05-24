import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RankingService } from './ranking.service';
import { RankingScraperService } from './ranking.scraper.service';
import { CreateRankingDto } from './dto/create-ranking.dto';
import { UpdateRankingDto } from './dto/update-ranking.dto';
import { ResponseService } from '../../common/services/response.service';

@Controller('ranking')
export class RankingController {
  constructor(
    private readonly rankingService: RankingService,
    private readonly rankingScraper: RankingScraperService,
    private readonly responseService: ResponseService,
  ) { }

  @MessagePattern('ranking.create')
  async create(@Payload() dto: CreateRankingDto) {
    return this.rankingService.create(dto);
  }

  @MessagePattern('ranking.findAll')
  async getAll(@Payload() query: any) {
    const data = await this.rankingService.findAll(query);
    // Wrap the service response so the outer payload contains `result`
    return this.responseService.successWithSingle(data, 'Fetched rankings').response;
  }

  // Preview scraper data without persisting
  @MessagePattern('ranking.preview')
  async preview(@Payload() params: any) {
    const data = await this.rankingService.previewScraperData(params);
    return this.responseService.successWithSingle(data, 'Scraper preview data').response;
  }

  @MessagePattern('ranking.findOne')
  async findOne(@Payload() id: string) {
    return this.rankingService.findOne(id);
  }

  @MessagePattern('ranking.update')
  async update(@Payload() payload: { id: string; dto: UpdateRankingDto }) {
    const { id, dto } = payload;
    const data = await this.rankingService.update(id, dto);
    return this.responseService.successWithSingle(data, 'Ranking updated successfully').response;
  }

  @MessagePattern('ranking.remove')
  async remove(@Payload() id: string) {
    await this.rankingService.remove(id);
    return this.responseService.success(null, 'Ranking removed successfully').response;
  }

  @MessagePattern('ranking.refresh')
  async refresh(@Payload() params: any) {
    try {
      const scraperData = await this.rankingScraper.fetchWithParams(params);
      await this.rankingService.refreshFromScraper(scraperData);
      return this.responseService.success(null, 'Rankings refreshed successfully').response;
    } catch (err) {
      return this.responseService.error('Failed to refresh rankings', 'RANKING_REFRESH_ERROR', err?.message).response;
    }
  }
}
