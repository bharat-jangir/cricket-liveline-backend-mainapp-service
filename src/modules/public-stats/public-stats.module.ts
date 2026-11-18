import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Match, MatchSchema } from '../../entities/match.entity';
import { BattingScorecard, BattingScorecardSchema } from '../../entities/batting-scorecard.entity';
import { BowlingScorecard, BowlingScorecardSchema } from '../../entities/bowling-scorecard.entity';
import { Player, PlayerSchema } from '../../entities/player.entity';
import { PublicStatsController } from './public-stats.controller';
import { PublicStatsService } from './public-stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: BattingScorecard.name, schema: BattingScorecardSchema },
      { name: BowlingScorecard.name, schema: BowlingScorecardSchema },
      { name: Player.name, schema: PlayerSchema },
    ]),
  ],
  controllers: [PublicStatsController],
  providers: [PublicStatsService],
})
export class PublicStatsModule {}
