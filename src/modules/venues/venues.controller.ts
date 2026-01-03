import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenueDto } from './dto/query-venue.dto';

@Controller()
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @MessagePattern('venues.create')
  async create(@Payload() createVenueDto: CreateVenueDto) {
    const result = await this.venuesService.create(createVenueDto);
    return result.response; // Return only the response part, statusCode is handled by gateway
  }

  @MessagePattern('venues.findAll')
  async findAll(@Payload() query: QueryVenueDto) {
    const result = await this.venuesService.findAll(query);
    return result.response;
  }

  @MessagePattern('venues.findOne')
  async findOne(@Payload() id: string) {
    const result = await this.venuesService.findOne(id);
    return result.response;
  }

  @MessagePattern('venues.update')
  async update(@Payload() data: { id: string; updateVenueDto: UpdateVenueDto }) {
    const result = await this.venuesService.update(data.id, data.updateVenueDto);
    return result.response;
  }

  @MessagePattern('venues.remove')
  async remove(@Payload() id: string) {
    const result = await this.venuesService.remove(id);
    return result.response;
  }
}

