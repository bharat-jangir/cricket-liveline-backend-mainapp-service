import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LiveMatchService } from './live-match.service';
import { LiveMatchController } from './live-match.controller';
import { Match, MatchSchema } from '../../entities/match.entity';
import { Inning, InningSchema } from '../../entities/inning.entity';
import { BattingScorecard, BattingScorecardSchema } from '../../entities/batting-scorecard.entity';
import { BowlingScorecard, BowlingScorecardSchema } from '../../entities/bowling-scorecard.entity';
import { MatchSquad, MatchSquadSchema } from '../../entities/match-squad.entity';
import { OverSummary, OverSummarySchema } from '../../entities/over-summary.entity';
import { LiveMatchSession, LiveMatchSessionSchema } from '../../entities/live-match-session.entity';
import { Player, PlayerSchema } from '../../entities/player.entity';
import { Venue, VenueSchema } from '../../entities/venue.entity';
import { Partnership, PartnershipSchema } from '../../entities/partnership.entity';
import { ResponseService } from '../../common/services/response.service';
import { ScoreEngineModule } from './score-engine/score-engine.module';
import { CommentaryGeneratorService } from './services/commentary-generator.service';


@Module({
  imports: [
    ScoreEngineModule, // Import the new module
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: Inning.name, schema: InningSchema },
      { name: BattingScorecard.name, schema: BattingScorecardSchema },
      { name: BowlingScorecard.name, schema: BowlingScorecardSchema },
      { name: MatchSquad.name, schema: MatchSquadSchema },
      { name: OverSummary.name, schema: OverSummarySchema },
      { name: LiveMatchSession.name, schema: LiveMatchSessionSchema },
      { name: Partnership.name, schema: PartnershipSchema },
      { name: Player.name, schema: PlayerSchema },
      { name: Venue.name, schema: VenueSchema },
    ]),
  ],
  controllers: [LiveMatchController],
  providers: [LiveMatchService, ResponseService, CommentaryGeneratorService],
  exports: [LiveMatchService],
})
export class LiveMatchModule { }

