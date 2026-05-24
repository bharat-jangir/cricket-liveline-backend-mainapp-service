import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FantasyStatsService } from './fantasy-stats.service';
import { CreateFantasyStatsDto } from './dto/create-fantasy-stats.dto';
import { UpdateFantasyStatsDto } from './dto/update-fantasy-stats.dto';
import { QueryFantasyStatsDto } from './dto/query-fantasy-stats.dto';
import { BulkCreateFantasyStatsDto } from './dto/bulk-create-fantasy-stats.dto';

@Controller()
export class FantasyStatsController {
  private readonly logger = new Logger(FantasyStatsController.name);

  constructor(private readonly fantasyStatsService: FantasyStatsService) {}

  @MessagePattern('fantasy-stats.create')
  async create(@Payload() payload: { seriesId: string; createDto: CreateFantasyStatsDto }) {
    try {
      const result = await this.fantasyStatsService.create(payload.seriesId, payload.createDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in create', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('fantasy-stats.findAll')
  async findAll(@Payload() payload: { seriesId: string; query: QueryFantasyStatsDto }) {
    try {
      const result = await this.fantasyStatsService.findAll(payload.seriesId, payload.query);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in findAll', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('fantasy-stats.findOne')
  async findOne(@Payload() id: string) {
    try {
      const result = await this.fantasyStatsService.findOne(id);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in findOne', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('fantasy-stats.update')
  async update(@Payload() payload: { id: string; updateDto: UpdateFantasyStatsDto }) {
    try {
      const result = await this.fantasyStatsService.update(payload.id, payload.updateDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in update', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('fantasy-stats.remove')
  async remove(@Payload() id: string) {
    try {
      const result = await this.fantasyStatsService.remove(id);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in remove', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('fantasy-stats.bulkCreate')
  async bulkCreate(@Payload() payload: { seriesId: string; bulkDto: BulkCreateFantasyStatsDto }) {
    try {
      const result = await this.fantasyStatsService.bulkCreate(payload.seriesId, payload.bulkDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in bulkCreate', error.stack || error.message || error);
      throw error;
    }
  }
  @MessagePattern('fantasy-stats.getSeriesLeaders')
  async getSeriesLeaders(@Payload() seriesId: string) {
    try {
      const result = await this.fantasyStatsService.getSeriesLeaders(seriesId);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in getSeriesLeaders', error.stack || error.message || error);
      throw error;
    }
  }
}

