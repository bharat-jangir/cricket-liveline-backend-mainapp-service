import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { Match, MatchSchema } from '../../entities/match.entity';
import { Team, TeamSchema } from '../../entities/team.entity';
import { MatchDetails, MatchDetailsSchema } from '../../entities/match-details.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: Team.name, schema: TeamSchema },
      { name: MatchDetails.name, schema: MatchDetailsSchema },
    ]),
  ],
  controllers: [MatchesController],
  providers: [MatchesService, ResponseService],
  exports: [MatchesService],
})
export class MatchesModule { }

