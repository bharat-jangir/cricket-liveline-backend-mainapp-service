import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SeriesService } from './series.service';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { QuerySeriesDto } from './dto/query-series.dto';

@Controller()
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @MessagePattern('series.create')
  async create(@Payload() createSeriesDto: CreateSeriesDto) {
    const result = await this.seriesService.create(createSeriesDto);
    return result.response; // Return only the response part, statusCode is handled by gateway
  }

  @MessagePattern('series.findAll')
  async findAll(@Payload() query: QuerySeriesDto) {
    const result = await this.seriesService.findAll(query);
    return result.response;
  }

  @MessagePattern('series.findOne')
  async findOne(@Payload() id: string) {
    const result = await this.seriesService.findOne(id);
    return result.response;
  }

  @MessagePattern('series.update')
  async update(@Payload() payload: { id: string; updateSeriesDto: UpdateSeriesDto }) {
    const result = await this.seriesService.update(payload.id, payload.updateSeriesDto);
    return result.response;
  }

  @MessagePattern('series.remove')
  async remove(@Payload() id: string) {
    const result = await this.seriesService.remove(id);
    return result.response;
  }
}

