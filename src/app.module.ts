import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VenuesModule } from './modules/venues/venues.module';
import { VenueStatsModule } from './modules/venue-stats/venue-stats.module';
import { UmpiresModule } from './modules/umpires/umpires.module';
import { TeamsModule } from './modules/teams/teams.module';
import { SeriesModule } from './modules/series/series.module';
import { SeriesTeamsModule } from './modules/series-teams/series-teams.module';
import { SeriesVenuesModule } from './modules/series-venues/series-venues.module';
import { PlayersModule } from './modules/players/players.module';
import { MatchesModule } from './modules/matches/matches.module';
import { PointsTablesModule } from './modules/points-tables/points-tables.module';
import { FantasyStatsModule } from './modules/fantasy-stats/fantasy-stats.module';
import { LiveMatchModule } from './modules/live-match/live-match.module';
import { RankingModule } from './modules/ranking/ranking.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URL') || 'mongodb://localhost:27017/cricket_db',
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    VenuesModule,
    VenueStatsModule,
    UmpiresModule,
    TeamsModule,
    SeriesModule,
    SeriesTeamsModule,
    SeriesVenuesModule,
    PlayersModule,
    MatchesModule,
    PointsTablesModule,
    FantasyStatsModule,
    LiveMatchModule,
    // LogsModule removed (custom logging not implemented)
    // New Ranking module
    RankingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

