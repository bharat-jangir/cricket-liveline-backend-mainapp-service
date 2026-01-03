import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeriesTeamsService } from './series-teams.service';
import { SeriesTeamsController } from './series-teams.controller';
import { SeriesTeam, SeriesTeamSchema } from '../../entities/series-team.entity';
import { PlayerTeam, PlayerTeamSchema } from '../../entities/player-team.entity';
import { Player, PlayerSchema } from '../../entities/player.entity';
import { Team, TeamSchema } from '../../entities/team.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeriesTeam.name, schema: SeriesTeamSchema },
      { name: PlayerTeam.name, schema: PlayerTeamSchema },
      { name: Player.name, schema: PlayerSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
  ],
  controllers: [SeriesTeamsController],
  providers: [SeriesTeamsService, ResponseService],
  exports: [SeriesTeamsService],
})
export class SeriesTeamsModule {}

