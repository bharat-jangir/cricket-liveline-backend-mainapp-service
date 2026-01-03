import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UmpiresService } from './umpires.service';
import { CreateUmpireDto } from './dto/create-umpire.dto';
import { UpdateUmpireDto } from './dto/update-umpire.dto';
import { QueryUmpiresDto } from './dto/query-umpires.dto';

@Controller()
export class UmpiresController {
  private readonly logger = new Logger(UmpiresController.name);

  constructor(private readonly umpiresService: UmpiresService) {}

  @MessagePattern('umpires.create')
  async create(@Payload() createUmpireDto: CreateUmpireDto) {
    this.logger.log('Received request to create umpire');
    const result = await this.umpiresService.create(createUmpireDto);
    return result.response;
  }

  @MessagePattern('umpires.findAll')
  async findAll(@Payload() query: QueryUmpiresDto) {
    this.logger.log('Received request to find all umpires');
    const result = await this.umpiresService.findAll(query);
    return result.response;
  }

  @MessagePattern('umpires.findOne')
  async findOne(@Payload() id: string) {
    this.logger.log(`Received request to find umpire: ${id}`);
    const result = await this.umpiresService.findOne(id);
    return result.response;
  }

  @MessagePattern('umpires.update')
  async update(@Payload() payload: { id: string; updateUmpireDto: UpdateUmpireDto }) {
    this.logger.log(`Received request to update umpire: ${payload.id}`);
    const result = await this.umpiresService.update(payload.id, payload.updateUmpireDto);
    return result.response;
  }

  @MessagePattern('umpires.remove')
  async remove(@Payload() id: string) {
    this.logger.log(`Received request to delete umpire: ${id}`);
    const result = await this.umpiresService.remove(id);
    return result.response;
  }
}

