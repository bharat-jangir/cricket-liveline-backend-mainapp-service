import { Controller, Logger, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UmpiresService } from './umpires.service';
import { CreateUmpireDto } from './dto/create-umpire.dto';
import { UpdateUmpireDto } from './dto/update-umpire.dto';
import { QueryUmpiresDto } from './dto/query-umpires.dto';

@Controller('umpires')
export class UmpiresController {
  private readonly logger = new Logger(UmpiresController.name);

  constructor(private readonly umpiresService: UmpiresService) {}

  @Get()
  async findAll(@Query() query: QueryUmpiresDto) {
    this.logger.log('REST: Received request to find all umpires with query:', query);
    const result = await this.umpiresService.findAll(query);
    this.logger.log('REST: Returning result:', result.response);
    return result.response;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.umpiresService.findOne(id);
    return result.response;
  }

  @Post()
  async create(@Body() createUmpireDto: CreateUmpireDto) {
    const result = await this.umpiresService.create(createUmpireDto);
    return result.response;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUmpireDto: UpdateUmpireDto) {
    const result = await this.umpiresService.update(id, updateUmpireDto);
    return result.response;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.umpiresService.remove(id);
    return result.response;
  }

  @MessagePattern('umpires.create')
  async createMessage(@Payload() createUmpireDto: CreateUmpireDto) {
    this.logger.log('Received request to create umpire');
    const result = await this.umpiresService.create(createUmpireDto);
    return result.response;
  }

  @MessagePattern('umpires.findAll')
  async findAllMessage(@Payload() query: QueryUmpiresDto) {
    this.logger.log('Received request to find all umpires');
    const result = await this.umpiresService.findAll(query);
    return result.response;
  }

  @MessagePattern('umpires.findOne')
  async findOneMessage(@Payload() id: string) {
    this.logger.log(`Received request to find umpire: ${id}`);
    const result = await this.umpiresService.findOne(id);
    return result.response;
  }

  @MessagePattern('umpires.update')
  async updateMessage(@Payload() payload: { id: string; updateUmpireDto: UpdateUmpireDto }) {
    this.logger.log(`Received request to update umpire: ${payload.id}`);
    const result = await this.umpiresService.update(payload.id, payload.updateUmpireDto);
    return result.response;
  }

  @MessagePattern('umpires.remove')
  async removeMessage(@Payload() id: string) {
    this.logger.log(`Received request to delete umpire: ${id}`);
    const result = await this.umpiresService.remove(id);
    return result.response;
  }
}

