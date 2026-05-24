import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeriesService } from './series.service';
import { SeriesController } from './series.controller';
import { Series, SeriesSchema } from '../../entities/series.entity';
import { SeriesTeam, SeriesTeamSchema } from '../../entities/series-team.entity';
import { Team, TeamSchema } from '../../entities/team.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Series.name, schema: SeriesSchema },
      { name: SeriesTeam.name, schema: SeriesTeamSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
  ],
  controllers: [SeriesController],
  providers: [SeriesService, ResponseService],
  exports: [SeriesService],
})
export class SeriesModule {}

