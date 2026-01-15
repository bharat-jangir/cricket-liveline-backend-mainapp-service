import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScoreEngineService } from './score-engine.service';
import { LiveMatchModule } from '../live-match.module';
import { ScoreHistory, ScoreHistorySchema } from '../../../entities/score-history.entity';
import { LiveMatchStatus, LiveMatchStatusSchema } from '../../../entities/live-match-status.entity';
import { Match, MatchSchema } from '../../../entities/match.entity';
import { Inning, InningSchema } from '../../../entities/inning.entity';
import { BattingScorecard, BattingScorecardSchema } from '../../../entities/batting-scorecard.entity';
import { BowlingScorecard, BowlingScorecardSchema } from '../../../entities/bowling-scorecard.entity';
import { MatchSquad, MatchSquadSchema } from '../../../entities/match-squad.entity';
import { OverSummary, OverSummarySchema } from '../../../entities/over-summary.entity';
import { RedisPublisherService } from '../../../common/redis/redis-publisher.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ScoreHistory.name, schema: ScoreHistorySchema },
            { name: LiveMatchStatus.name, schema: LiveMatchStatusSchema },
            { name: Match.name, schema: MatchSchema },
            { name: Inning.name, schema: InningSchema },
            { name: BattingScorecard.name, schema: BattingScorecardSchema },
            { name: BowlingScorecard.name, schema: BowlingScorecardSchema },
            { name: MatchSquad.name, schema: MatchSquadSchema },
            { name: OverSummary.name, schema: OverSummarySchema },
        ]),
    ],
    providers: [ScoreEngineService, RedisPublisherService],
    exports: [ScoreEngineService],
})
export class ScoreEngineModule { }
