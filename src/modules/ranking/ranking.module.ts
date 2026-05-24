import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ranking, RankingSchema } from './ranking.entity';
import { RankingService } from './ranking.service';
import { RankingController } from './ranking.controller';
import { RankingScraperService } from './ranking.scraper.service';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Ranking.name, schema: RankingSchema }])],
  providers: [RankingService, RankingScraperService, ResponseService],
  controllers: [RankingController],
  exports: [RankingService],
})
export class RankingModule { }
