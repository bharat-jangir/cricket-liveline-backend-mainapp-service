const { NestFactory } = require('@nestjs/core');
const { RankingModule } = require('./dist/modules/ranking/ranking.module');
const { RankingScraperService } = require('./dist/modules/ranking/ranking.scraper.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(RankingModule);
  const scraperService = app.get(RankingScraperService);

  console.log('Fetching T20 Batting Rankings...');
  const players = await scraperService.fetchWithParams({
    type: 'player',
    gender: 'men',
    format: 't20',
    role: 'batting' // or 'batsman', let's check what UI uses. It uses 'batsman'.
  });

  console.log('Result:');
  console.log(players.slice(0, 3));
  
  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
