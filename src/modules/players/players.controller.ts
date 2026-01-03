import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';

@Controller()
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @MessagePattern('players.create')
  async create(@Payload() createPlayerDto: CreatePlayerDto) {
    const result = await this.playersService.create(createPlayerDto);
    return result.response;
  }

  @MessagePattern('players.findAll')
  async findAll(@Payload() query: QueryPlayersDto) {
    const result = await this.playersService.findAll(query);
    return result.response;
  }

  @MessagePattern('players.findOne')
  async findOne(@Payload() id: string) {
    const result = await this.playersService.findOne(id);
    return result.response;
  }

  @MessagePattern('players.update')
  async update(@Payload() payload: { id: string; updatePlayerDto: UpdatePlayerDto }) {
    const result = await this.playersService.update(payload.id, payload.updatePlayerDto);
    return result.response;
  }

  @MessagePattern('players.remove')
  async remove(@Payload() id: string) {
    const result = await this.playersService.remove(id);
    return result.response;
  }
}

