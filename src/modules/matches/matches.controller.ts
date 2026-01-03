import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';

@Controller()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @MessagePattern('matches.create')
  async create(@Payload() createMatchDto: CreateMatchDto) {
    const result = await this.matchesService.create(createMatchDto);
    return result.response;
  }

  @MessagePattern('matches.findAll')
  async findAll(@Payload() query: QueryMatchesDto) {
    const result = await this.matchesService.findAll(query);
    return result.response;
  }

  @MessagePattern('matches.findOne')
  async findOne(@Payload() id: string) {
    const result = await this.matchesService.findOne(id);
    return result.response;
  }

  @MessagePattern('matches.update')
  async update(@Payload() payload: { id: string; updateMatchDto: UpdateMatchDto }) {
    const result = await this.matchesService.update(payload.id, payload.updateMatchDto);
    return result.response;
  }

  @MessagePattern('matches.remove')
  async remove(@Payload() id: string) {
    const result = await this.matchesService.remove(id);
    return result.response;
  }
}

