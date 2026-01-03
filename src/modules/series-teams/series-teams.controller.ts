import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SeriesTeamsService } from './series-teams.service';
import { AddTeamToSeriesDto, UpdateSquadDto, QuerySeriesTeamsDto } from './dto/series-teams.dto';

@Controller()
export class SeriesTeamsController {
  constructor(private readonly seriesTeamsService: SeriesTeamsService) {}

  @MessagePattern('series-teams.addTeam')
  async addTeam(@Payload() payload: { seriesId: string; addTeamDto: AddTeamToSeriesDto }) {
    const result = await this.seriesTeamsService.addTeamToSeries(
      payload.seriesId,
      payload.addTeamDto,
    );
    return result.response;
  }

  @MessagePattern('series-teams.getTeams')
  async getTeams(@Payload() payload: { seriesId: string; query: QuerySeriesTeamsDto }) {
    const result = await this.seriesTeamsService.getSeriesTeams(
      payload.seriesId,
      payload.query,
    );
    return result.response;
  }

  @MessagePattern('series-teams.getSquad')
  async getSquad(@Payload() payload: { seriesId: string; teamId: string; format: string }) {
    const result = await this.seriesTeamsService.getTeamSquad(
      payload.seriesId,
      payload.teamId,
      payload.format,
    );
    return result.response;
  }

  @MessagePattern('series-teams.updateSquad')
  async updateSquad(
    @Payload()
    payload: {
      seriesId: string;
      teamId: string;
      format: string;
      updateSquadDto: UpdateSquadDto;
    },
  ) {
    const result = await this.seriesTeamsService.updateSquad(
      payload.seriesId,
      payload.teamId,
      payload.format,
      payload.updateSquadDto,
    );
    return result.response;
  }

  @MessagePattern('series-teams.removeTeam')
  async removeTeam(@Payload() payload: { seriesId: string; teamId: string; format: string }) {
    const result = await this.seriesTeamsService.removeTeamFromSeries(
      payload.seriesId,
      payload.teamId,
      payload.format,
    );
    return result.response;
  }
}

