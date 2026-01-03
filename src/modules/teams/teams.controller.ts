import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { QueryTeamsDto } from './dto/query-teams.dto';

@Controller()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @MessagePattern('teams.create')
  async create(@Payload() createTeamDto: CreateTeamDto) {
    const result = await this.teamsService.create(createTeamDto);
    return result.response; // Return only the response part, statusCode is handled by gateway
  }

  @MessagePattern('teams.findAll')
  async findAll(@Payload() query: QueryTeamsDto) {
    const result = await this.teamsService.findAll(query);
    return result.response;
  }

  @MessagePattern('teams.findOne')
  async findOne(@Payload() id: string) {
    const result = await this.teamsService.findOne(id);
    return result.response;
  }

  @MessagePattern('teams.update')
  async update(@Payload() payload: { id: string; updateTeamDto: UpdateTeamDto }) {
    const result = await this.teamsService.update(payload.id, payload.updateTeamDto);
    return result.response;
  }

  @MessagePattern('teams.remove')
  async remove(@Payload() id: string) {
    const result = await this.teamsService.remove(id);
    return result.response;
  }
}

