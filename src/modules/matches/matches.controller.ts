import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  async findAll(@Query() query: QueryMatchesDto) {
    const result = await this.matchesService.findAll(query);
    return result.response;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.matchesService.findOne(id);
    return result.response;
  }

  @Post()
  async create(@Body() createMatchDto: CreateMatchDto) {
    const result = await this.matchesService.create(createMatchDto);
    return result.response;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateMatchDto: UpdateMatchDto) {
    const result = await this.matchesService.update(id, updateMatchDto);
    return result.response;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.matchesService.remove(id);
    return result.response;
  }

  @MessagePattern('matches.create')
  async createMessage(@Payload() createMatchDto: CreateMatchDto) {
    const result = await this.matchesService.create(createMatchDto);
    return result.response;
  }

  @MessagePattern('matches.findAll')
  async findAllMessage(@Payload() query: QueryMatchesDto) {
    const result = await this.matchesService.findAll(query);
    return result.response;
  }

  @MessagePattern('matches.findOne')
  async findOneMessage(@Payload() id: string) {
    const result = await this.matchesService.findOne(id);
    return result.response;
  }

  @MessagePattern('matches.update')
  async updateMessage(@Payload() payload: { id: string; updateMatchDto: UpdateMatchDto }) {
    const result = await this.matchesService.update(payload.id, payload.updateMatchDto);
    return result.response;
  }

  @MessagePattern('matches.remove')
  async removeMessage(@Payload() id: string) {
    const result = await this.matchesService.remove(id);
    return result.response;
  }
}

