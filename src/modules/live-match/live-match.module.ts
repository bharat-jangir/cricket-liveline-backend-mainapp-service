import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LiveMatchService } from './live-match.service';
import { LiveMatchController } from './live-match.controller';
import { LiveMatchStatus, LiveMatchStatusSchema } from '../../entities/live-match-status.entity';
import { Match, MatchSchema } from '../../entities/match.entity';
import { Inning, InningSchema } from '../../entities/inning.entity';
import { BattingScorecard, BattingScorecardSchema } from '../../entities/batting-scorecard.entity';
import { BowlingScorecard, BowlingScorecardSchema } from '../../entities/bowling-scorecard.entity';
import { MatchSquad, MatchSquadSchema } from '../../entities/match-squad.entity';
import { OverSummary, OverSummarySchema } from '../../entities/over-summary.entity';
import { MatchDetails, MatchDetailsSchema } from '../../entities/match-details.entity';
import { LiveMatchSession, LiveMatchSessionSchema } from '../../entities/live-match-session.entity';
import { ResponseService } from '../../common/services/response.service';
import { ScoreEngineModule } from './score-engine/score-engine.module';


@Module({
  imports: [
    ScoreEngineModule, // Import the new module
    MongooseModule.forFeature([
      { name: LiveMatchStatus.name, schema: LiveMatchStatusSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Inning.name, schema: InningSchema },
      { name: BattingScorecard.name, schema: BattingScorecardSchema },
      { name: BowlingScorecard.name, schema: BowlingScorecardSchema },
      { name: MatchSquad.name, schema: MatchSquadSchema },
      { name: OverSummary.name, schema: OverSummarySchema },
      { name: MatchDetails.name, schema: MatchDetailsSchema },
      { name: LiveMatchSession.name, schema: LiveMatchSessionSchema },
    ]),
  ],
  controllers: [LiveMatchController],
  providers: [LiveMatchService, ResponseService],
  exports: [LiveMatchService],
})
export class LiveMatchModule { }

