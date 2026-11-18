/**
 * Test-data seeder.
 *
 *   SEED_MONGODB_URL=mongodb://127.0.0.1:27017/cricket_seed npm run seed
 *   npm run seed:reset      # remove previously seeded data, then seed again
 *   npm run seed:purge      # remove seeded data only
 *
 * Safety: it NEVER reads MONGODB_URL from .env. A target URL must be passed explicitly and must be
 * local unless --allow-remote is given. Seeded documents use deterministic ids, so purge/reset only
 * touch data created by this script.
 */
import 'reflect-metadata';
import { Types } from 'mongoose';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const arg = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const url = arg('url') || process.env.SEED_MONGODB_URL;
if (!url) {
  console.error('Refusing to run: pass the target database explicitly, e.g.\n  SEED_MONGODB_URL=mongodb://127.0.0.1:27017/cricket_seed npm run seed');
  process.exit(1);
}
const host = (url.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/:?,]+)/) || [])[1] || '';
const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host);
if (!isLocal && !flag('allow-remote')) {
  console.error(`Refusing to seed non-local database "${host}". Re-run with --allow-remote if you really mean it.`);
  process.exit(1);
}
// Must be set BEFORE the app module is loaded so ConfigService can't fall back to .env
process.env.MONGODB_URL = url;
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;

async function main() {
  const { Test } = await import('@nestjs/testing');
  const { getModelToken } = await import('@nestjs/mongoose');
  const { AppModule } = await import('../../src/app.module');
  const { RedisPublisherService } = await import('../../src/common/redis/redis-publisher.service');
  const { ScoreEngineService } = await import('../../src/modules/live-match/score-engine/score-engine.service');
  const { LiveMatchService } = await import('../../src/modules/live-match/live-match.service');
  const E = {
    Team: (await import('../../src/entities/team.entity')).Team,
    Player: (await import('../../src/entities/player.entity')).Player,
    Venue: (await import('../../src/entities/venue.entity')).Venue,
    Umpire: (await import('../../src/entities/umpire.entity')).Umpire,
    Series: (await import('../../src/entities/series.entity')).Series,
    SeriesTeam: (await import('../../src/entities/series-team.entity')).SeriesTeam,
    SeriesVenue: (await import('../../src/entities/series-venue.entity')).SeriesVenue,
    Match: (await import('../../src/entities/match.entity')).Match,
    Inning: (await import('../../src/entities/inning.entity')).Inning,
    Batting: (await import('../../src/entities/batting-scorecard.entity')).BattingScorecard,
    Bowling: (await import('../../src/entities/bowling-scorecard.entity')).BowlingScorecard,
    Squad: (await import('../../src/entities/match-squad.entity')).MatchSquad,
    Over: (await import('../../src/entities/over-summary.entity')).OverSummary,
    Partnership: (await import('../../src/entities/partnership.entity')).Partnership,
    History: (await import('../../src/entities/score-history.entity')).ScoreHistory,
    Points: (await import('../../src/entities/points-table.entity')).PointsTable,
    User: (await import('../../src/entities/user.entity')).User,
    Ranking: (await import('../../src/modules/ranking/ranking.entity')).Ranking,
    Article: (await import('../../src/entities/article.entity')).Article,
    Short: (await import('../../src/entities/short.entity')).Short,
  };
  const { getRules, formatDefaults } = await import('../../src/modules/live-match/match-rules');
  const { oid, rng, TEAMS, playersFor, VENUES, UMPIRES, SERIES, RANKING_TEAMS } = await import('./data');
  const { playInning } = await import('./simulate');

  // The score engine publishes to Redis; seeding must not depend on (or hang on) a Redis server.
  // (must not expose `then`, or Nest would await the proxy forever)
  const noopRedis = new Proxy({}, { get: (_t, prop) => (prop === 'then' || typeof prop === 'symbol' ? undefined : async () => undefined) });

  console.log(`Seeding database on host "${host}" …`);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RedisPublisherService).useValue(noopRedis)
    .compile();
  await moduleRef.init();

  const M = (cls: any) => moduleRef.get<any>(getModelToken(cls.name), { strict: false });
  const m = Object.fromEntries(Object.entries(E).map(([k, v]) => [k, M(v)])) as Record<keyof typeof E, any>;
  const conn = m.Match.db;
  if (!['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(conn.host) && !flag('allow-remote')) {
    throw new Error(`Connected to unexpected host "${conn.host}" — aborting before any write.`);
  }
  const engine = moduleRef.get(ScoreEngineService, { strict: false });
  const liveMatch = moduleRef.get(LiveMatchService, { strict: false });

  // ---------- plan (pure data, used by both purge and seed) ---------------------------------
  const teamPlayers = new Map(TEAMS.map((t) => [t.key, playersFor(t)]));
  const allPlayers = [...teamPlayers.values()].flat();
  const names = new Map<string, string>(allPlayers.map((p) => [p.id.toString(), p.name]));
  const teamId = (k: string) => oid(`team:${k}`);
  const venueId = (k: string) => oid(`venue:${k}`);
  const seriesId = (k: string) => oid(`series:${k}`);
  const matchId = (k: string) => oid(`match:${k}`);
  const MATCH_KEYS: string[] = [];

  // ---------- purge ---------------------------------------------------------------------------
  const purge = async () => {
    const ids = (keys: string[], f: (k: string) => Types.ObjectId) => keys.map(f);
    const matchIds = ids(MATCH_KEYS_ALL, matchId);
    const sIds = ids(SERIES.map((s) => s.key), seriesId);
    const byMatch = { matchId: { $in: matchIds } };
    await Promise.all([
      m.Inning.deleteMany(byMatch), m.Batting.deleteMany(byMatch), m.Bowling.deleteMany(byMatch), m.Over.deleteMany(byMatch),
      m.Partnership.deleteMany(byMatch), m.History.deleteMany(byMatch), m.Squad.deleteMany(byMatch),
    ]);
    // Super-over innings are created by the app with random ids but carry the seeded matchId (covered above)
    await m.Match.deleteMany({ _id: { $in: matchIds } });
    await m.SeriesTeam.deleteMany({ seriesId: { $in: sIds } });
    await m.SeriesVenue.deleteMany({ seriesId: { $in: sIds } });
    await m.Points.deleteMany({ seriesId: { $in: sIds } });
    await m.Series.deleteMany({ _id: { $in: sIds } });
    await m.Player.deleteMany({ _id: { $in: allPlayers.map((p) => p.id) } });
    await m.Team.deleteMany({ _id: { $in: TEAMS.map((t) => teamId(t.key)) } });
    await m.Venue.deleteMany({ _id: { $in: VENUES.map((v) => venueId(v.key)) } });
    await m.Umpire.deleteMany({ _id: { $in: UMPIRES.map((_, i) => oid(`umpire:${i}`)) } });
    await m.Ranking.deleteMany({ cricbuzzId: /^seed-/ });
    await m.Article.deleteMany({ slug: /^seed-/ });
    await m.Short.deleteMany({ _id: { $in: [0, 1, 2, 3].map((i) => oid(`short:${i}`)) } });
    await m.User.deleteMany({ _id: { $in: [oid('user:admin'), oid('user:scorer')] } });
    console.log('Purged previously seeded data.');
  };

  // every match key used below (kept in one list so purge is exact)
  const MATCH_KEYS_ALL = [
    'it20-1', 'it20-2', 'it20-3-live', 'it20-4', 'it20-5', 'odi-1', 'odi-2-live', 'odi-3', 'test-1-live', 'test-2',
    'h-1', 'h-2-live', 'h-3', 'l-1', 'l-2', 'l-3-tie-so', 'l-4', 'l-5', 'l-6', 't10-1', 't10-2', 't10-3',
    'asia-1', 'asia-2', 'tri-1-legacy', 'abandoned-1', 'cancelled-1', 'hidden-1',
  ];
  MATCH_KEYS.push(...MATCH_KEYS_ALL);

  const created: string[] = [];
  const seedUsers = async () => {
    // dev logins (password hashed by the schema hook).
    // Local DB: fixed, documented passwords. Remote DB: random passwords printed once (never a known default).
    const { randomBytes } = await import('crypto');
    const rand = () => `${randomBytes(9).toString('base64url')}!9a`;
    const pw: Record<string, string> = isLocal
      ? { admin: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345', scorer: process.env.SEED_SCORER_PASSWORD || 'Scorer@12345' }
      : { admin: process.env.SEED_ADMIN_PASSWORD || rand(), scorer: process.env.SEED_SCORER_PASSWORD || rand() };
    for (const [key, email, role, name] of [
      ['admin', 'admin@cricket.test', 'super_admin', 'Seed Admin'],
      ['scorer', 'scorer@cricket.test', 'scorer', 'Seed Scorer'],
    ] as const) {
      if (!(await m.User.exists({ _id: oid(`user:${key}`) }))) {
        await new m.User({ _id: oid(`user:${key}`), email, password: pw[key], name, role, isActive: true, isVerified: true, emailVerified: true }).save();
        created.push(`${email} / ${pw[key]}`);
      }
    }
  };

  if (flag('users-only')) { await seedUsers(); console.log('Users:', created.join(' | ') || 'already existed'); await moduleRef.close(); return; }
  if (flag('reset') || flag('purge-only')) await purge();
  if (flag('purge-only')) { await moduleRef.close(); return; }

  // ---------- base data -----------------------------------------------------------------------
  await m.Venue.insertMany(VENUES.map((v) => ({ _id: venueId(v.key), name: v.name, city: v.city, country: v.country, capacity: v.capacity })), { ordered: false }).catch(dupOk);
  await m.Umpire.insertMany(UMPIRES.map((name, i) => ({ _id: oid(`umpire:${i}`), name })), { ordered: false }).catch(dupOk);
  await m.Team.insertMany(TEAMS.map((t) => ({
    _id: teamId(t.key), name: t.name, shortName: t.short, code: t.code, country: t.country,
    type: t.kind, teamType: t.kind === 'international' ? 'international' : 'league', gender: t.gender, colorCode: t.color,
  })), { ordered: false }).catch(dupOk);
  await m.Player.insertMany(allPlayers.map((p) => ({
    _id: p.id, name: p.name, fullName: p.name, slug: p.slug, role: p.role, battingStyle: p.hand, bowlingArm: p.arm,
    country: TEAMS.find((t) => t.key === p.teamKey)!.country, gender: 'male', currentTeamIds: [teamId(p.teamKey)], jerseyNumber: p.idx + 1,
  })), { ordered: false }).catch(dupOk);

  await seedUsers();

  const SERIES_VENUES: Record<string, string[]> = {
    'ind-aus-t20i': ['mcg', 'wankhede'], 'eng-rsa-odi': ['newlands', 'lords'], 'nz-pak-test': ['hagley'], hundred: ['lords', 'oval'],
    'premier-t20': ['wankhede'], 't10-blast': ['oval'], 'asia-cup': ['wankhede'], 'tri-series-2025': ['newlands'],
  };

  // ---------- news + shorts (content CMS test data) ----------------------------------------
  const seedContent = async () => {
    const done = await m.Match.find({ slug: /^seed-/, status: 'completed', 'result.resultText': { $exists: true } }).sort({ matchDate: -1 }).limit(6).lean();
    const live = await m.Match.find({ slug: /^seed-/, status: 'live' }).limit(2).lean();
    const adminId = oid('user:admin');
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000);
    const docs: any[] = [];
    done.forEach((mt: any, i: number) => {
      docs.push({
        slug: `seed-report-${mt.slug.replace('seed-', '')}`, title: `${mt.title.split(',')[0]}: ${mt.result.resultText}`,
        summary: `A full report from ${mt.title}.`,
        body: `${mt.result.resultText}.\n\n## How it unfolded\n\nThe match produced plenty of talking points across both innings, with the result decided late on. Full scorecard and ball-by-ball commentary are available on the match page.\n\n## What next\n\nBoth sides now turn their attention to the remaining fixtures in the series.`,
        category: 'match-report', tags: ['test-data', mt.matchFormat], isFeatured: i === 0, matchId: mt._id, seriesId: mt.seriesId, publishedAt: ago(4 + i * 7),
      });
    });
    live.forEach((mt: any, i: number) => docs.push({
      slug: `seed-preview-${mt.slug.replace('seed-', '')}`, title: `Live: ${mt.title.split(',')[0]} — what to watch`,
      summary: 'Key battles to follow while the match is in progress.',
      body: `The match is under way.\n\n## Key battles\n\nThe openers against the new ball, and how the middle overs are managed, are likely to decide this one.\n\n## Follow live\n\nOpen the match page for ball-by-ball commentary and the live scorecard.`,
      category: 'preview', tags: ['test-data'], isFeatured: false, matchId: mt._id, seriesId: mt.seriesId, publishedAt: ago(1 + i),
    }));
    docs.push(
      { slug: 'seed-analysis-the-hundred-sets', title: 'Explained: how The Hundred’s 5-ball sets change bowling plans', summary: 'Two sets in a row, 20 balls a bowler, and a 25-ball powerplay.', body: 'The Hundred replaces overs with 5-ball sets and 100-ball innings.\n\n## Bowling quotas\n\nA bowler delivers either five or ten consecutive balls and no more than 20 in total, so captains plan around pairs of sets.\n\n## Powerplay\n\nThe first 25 balls are a powerplay, which makes the opening five sets the key batting window.', category: 'analysis', tags: ['test-data', 'the-hundred'], isFeatured: false, publishedAt: ago(30) },
      { slug: 'seed-rules-super-over', title: 'Super Over rules: what happens when a T20 ends level', summary: 'One over each, two wickets, and another if it ties again.', body: 'When a limited-overs match is tied, a Super Over decides the winner.\n\n## The basics\n\nEach side faces one over (five balls in The Hundred) with a maximum of two wickets lost.\n\n## If it ties again\n\nFurther Super Overs are played until there is a winner.', category: 'rules', tags: ['test-data'], isFeatured: false, publishedAt: ago(50) },
    );
    for (const d of docs) {
      await m.Article.updateOne({ slug: d.slug }, { $setOnInsert: { ...d, status: 'published', authorId: adminId, authorName: 'Seed Admin', views: 0 } }, { upsert: true });
    }
    // A draft and a scheduled article, to exercise the CMS states
    await m.Article.updateOne({ slug: 'seed-draft-example' }, { $setOnInsert: { slug: 'seed-draft-example', title: 'Draft: not visible to readers', body: 'This draft should never appear in the public API.', category: 'general', tags: ['test-data'], status: 'draft', authorName: 'Seed Admin', authorId: adminId } }, { upsert: true });
    await m.Article.updateOne({ slug: 'seed-scheduled-example' }, { $setOnInsert: { slug: 'seed-scheduled-example', title: 'Scheduled: goes live next week', body: 'This article is scheduled for the future.', category: 'general', tags: ['test-data'], status: 'published', publishedAt: new Date(Date.now() + 7 * 86_400_000), authorName: 'Seed Admin', authorId: adminId } }, { upsert: true });

    // Shorts use public sample files purely as playable test media (not cricket footage)
    const base = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';
    const clips = [['ForBiggerBlazes', 15], ['ForBiggerEscapes', 15], ['ForBiggerFun', 60], ['ForBiggerJoyrides', 15]] as const;
    for (const [i, [name, dur]] of clips.entries()) {
      await m.Short.updateOne({ _id: oid(`short:${i}`) }, { $setOnInsert: { _id: oid(`short:${i}`), title: `Sample clip ${i + 1} (test data)`, description: 'Placeholder media used to test playback.', videoUrl: `${base}/${name}.mp4`, thumbnail: `${base}/images/${name}.jpg`, durationSec: dur, tags: ['test-data'], status: 'published', publishedAt: ago(i + 1), authorId: adminId, views: 0, likes: 0 } }, { upsert: true });
    }
    console.log(`   content: ${docs.length + 2} articles (incl. 1 draft, 1 scheduled), ${clips.length} shorts`);
  };

  // ---------- series --------------------------------------------------------------------------
  const day = 86_400_000;
  const now = Date.now();
  for (const s of SERIES) {
    const sp = s as any;
    await m.Series.updateOne({ _id: seriesId(s.key) }, {
      $setOnInsert: {
        _id: seriesId(s.key), key: `seed-${s.key}`, name: s.name, shortName: s.short, fantasyName: s.name, fantasyShortName: s.short,
        activeFormat: s.fmt, seriesType: s.type, gender: s.gender, category: s.type === 'League' ? 'League' : 'International',
        startDate: new Date(now + s.startOff * day), endDate: new Date(now + s.endOff * day), status: s.status,
        year: new Date(now + s.startOff * day).getFullYear(), isFeatured: s.featured, onHome: s.featured, hasFixtures: true,
        hasPoints: !!sp.points, totalTeams: s.teams.length, isActive: true,
      },
    }, { upsert: true });
    // per-series squads (15 players each, with captain / vice-captain / keeper flags)
    for (const t of s.teams) {
      const ps = teamPlayers.get(t)!;
      await m.SeriesTeam.updateOne({ _id: oid(`seriesteam:${s.key}:${t}`) }, {
        $set: {
          squadPlayers: ps.map((p) => ({
            playerId: p.id, role: p.role, jerseyNumber: p.idx + 1,
            isCaptain: p.idx === 0, isViceCaptain: p.idx === 1, isWicketKeeper: p.idx === 4, isNotEligible: false,
          })),
        },
        $setOnInsert: { _id: oid(`seriesteam:${s.key}:${t}`), seriesId: seriesId(s.key), teamId: teamId(t), format: s.fmt },
      }, { upsert: true });
    }
    for (const [i, v] of (SERIES_VENUES[s.key] || []).entries()) {
      await m.SeriesVenue.updateOne({ _id: oid(`seriesvenue:${s.key}:${v}`) }, {
        $setOnInsert: { _id: oid(`seriesvenue:${s.key}:${v}`), seriesId: seriesId(s.key), venueId: venueId(v), isActive: true, priority: i },
      }, { upsert: true });
    }
  }
  if (flag('content-only')) { await seedContent(); console.log('Content seeded.'); await moduleRef.close(); return; }
  if (flag('base-only')) { console.log('Base data (teams, players, series, squads, venues) seeded.'); await moduleRef.close(); return; }

  // ---------- match helpers -------------------------------------------------------------------
  const FMT_META: Record<string, { fmt: string; type: string; innings: number }> = {
    t20: { fmt: 't20', type: 'league', innings: 2 }, t20i: { fmt: 't20i', type: 'international', innings: 2 },
    odi: { fmt: 'odi', type: 'international', innings: 2 }, test: { fmt: 'test', type: 'international', innings: 4 },
    t10: { fmt: 't10', type: 'league', innings: 2 }, hundred: { fmt: 'hundred', type: 'league', innings: 2 },
  };
  const tname = (k: string) => TEAMS.find((t) => t.key === k)!;
  const xi = (k: string) => teamPlayers.get(k)!.slice(0, 11).map((p) => p.id);
  const ctx = { engine, models: { match: m.Match, inning: m.Inning, batting: m.Batting, bowling: m.Bowling }, names, log: (s: string) => console.log(s) };

  interface Spec {
    key: string; series: string; no: number; a: string; b: string; venue: string; fmt: keyof typeof FMT_META;
    status: 'scheduled' | 'live' | 'completed' | 'abandoned' | 'cancelled';
    offsetHours: number; hidden?: boolean; label?: string;
  }
  const createMatch = async (sp: Spec) => {
    const meta = FMT_META[sp.fmt];
    const d = formatDefaults(meta.fmt);
    const title = `${tname(sp.a).name} vs ${tname(sp.b).name}, ${sp.label || `Match ${sp.no}`}`;
    const date = new Date(now + sp.offsetHours * 3_600_000);
    await m.Match.updateOne({ _id: matchId(sp.key) }, {
      $setOnInsert: {
        _id: matchId(sp.key), title, shortTitle: `${tname(sp.a).code} vs ${tname(sp.b).code}`, slug: `seed-${sp.key}`, matchNumber: sp.no,
        matchType: meta.type, matchFormat: meta.fmt, ...d, totalInnings: meta.innings, seriesId: seriesId(sp.series),
        teamAId: teamId(sp.a), teamBId: teamId(sp.b), venueId: venueId(sp.venue), matchDate: date, matchTime: date,
        status: sp.status === 'completed' ? 'live' : sp.status, matchState: 'toss_pending', currentInning: 1, isNotShowing: !!sp.hidden,
        officials: { umpire1Id: oid('umpire:0'), umpire2Id: oid('umpire:1'), thirdUmpireId: oid('umpire:2'), refereeId: oid('umpire:3') },
      },
    }, { upsert: true });
    return matchId(sp.key);
  };
  const createSquads = async (id: Types.ObjectId, a: string, b: string) => {
    for (const k of [a, b]) {
      const ps = teamPlayers.get(k)!;
      await m.Squad.updateOne({ matchId: id, teamId: teamId(k) }, {
        $setOnInsert: {
          matchId: id, teamId: teamId(k), playingXI: ps.slice(0, 11).map((p) => p.id), bench: ps.slice(11).map((p) => p.id),
          captainId: ps[0].id, viceCaptainId: ps[1].id, wicketKeeperId: ps[4].id,
        },
      }, { upsert: true });
    }
  };
  const planFor = (id: Types.ObjectId, rules: any, inningNumber: number, bat: string, bowl: string, style: any, extra: any) => ({
    matchId: id, inningNumber, battingTeamId: teamId(bat), bowlingTeamId: teamId(bowl), batters: xi(bat),
    bowlers: teamPlayers.get(bowl)!.slice(5, 11).map((p) => p.id), fielders: xi(bowl), keeper: teamPlayers.get(bowl)![4].id,
    rules, style, ...extra,
  });

  interface Play extends Spec {
    elected?: 'bat' | 'bowl'; tossWinner?: 'a' | 'b';
    biasFirst?: number; biasSecond?: number;
    /** leave the match in progress after this many balls of the last scheduled inning */
    liveAt?: number;
    /** engineer a tie after the 2nd innings, then play a super over */
    tieThenSuperOver?: boolean;
    style?: 't20' | 'odi' | 'test' | 't10' | 'hundred';
  }
  const playMatch = async (sp: Play) => {
    console.log(`▶ ${sp.key}: ${tname(sp.a).name} vs ${tname(sp.b).name} (${sp.fmt})`);
    const id = await createMatch({ ...sp, status: 'live' });
    await createSquads(id, sp.a, sp.b);
    const match = await m.Match.findById(id).lean();
    const rules = getRules(match);
    const winner = sp.tossWinner === 'b' ? sp.b : sp.a;
    const elected = sp.elected || 'bat';
    const first = elected === 'bat' ? winner : winner === sp.a ? sp.b : sp.a;
    const second = first === sp.a ? sp.b : sp.a;
    await m.Match.updateOne({ _id: id }, { $set: { status: 'live', matchState: 'normal', toss: { tossText: `${tname(winner).name} won the toss and elected to ${elected === 'bat' ? 'bat' : 'field'} first`, winnerId: teamId(winner), elected, tossTime: new Date() } } });
    const style = sp.style || (sp.fmt === 'hundred' ? 'hundred' : sp.fmt === 'odi' ? 'odi' : sp.fmt === 'test' ? 'test' : sp.fmt === 't10' ? 't10' : 't20');
    const seed = `match:${sp.key}`;

    const isTest = sp.fmt === 'test';
    const live1 = sp.liveAt !== undefined && (isTest ? false : sp.liveAt < 0);
    // innings 1
    const r1 = await playInning(ctx, planFor(id, rules, 1, first, second, style, { label: `${tname(first).code} inns 1`, seed: `${seed}:1`, bias: sp.biasFirst, ...(sp.liveAt !== undefined && sp.liveAt < 0 ? { stopAfterBalls: -sp.liveAt } : {}) }) as any);
    if (live1) return;
    if (isTest) {
      // Test: inning 2 in progress
      await m.Match.updateOne({ _id: id }, { $set: { matchState: 'normal' } });
      await playInning(ctx, planFor(id, rules, 2, second, first, style, { label: `${tname(second).code} inns 1`, seed: `${seed}:2`, bias: sp.biasSecond, stopAfterBalls: sp.liveAt ?? 220 }) as any);
      return;
    }
    // innings 2
    const target = r1.runs + 1;
    const plan2: any = planFor(id, rules, 2, second, first, style, { label: `${tname(second).code} inns 2 (target ${target})`, seed: `${seed}:2`, bias: sp.biasSecond, target });
    if (sp.tieThenSuperOver) { plan2.capRuns = r1.runs; plan2.tieMode = true; plan2.target = undefined; plan2.bias = 1.15; }
    if (sp.liveAt !== undefined && sp.liveAt >= 0) plan2.stopAfterBalls = sp.liveAt;
    await playInning(ctx, plan2);
    if (sp.liveAt !== undefined && sp.liveAt >= 0) return; // leave live

    await liveMatch.checkMatchConclusion(id.toString());

    if (sp.tieThenSuperOver) {
      const res = await liveMatch.startSuperOver(id.toString());
      if (!res.response.status) {
        console.warn(`   ⚠ tie was not reached (${res.response.developerMessage}); keeping the normal result`);
        const fin = await m.Match.findById(id).lean();
        console.log(`   result: ${fin.status} — ${fin.result?.resultText || 'n/a'}`);
        return;
      }
      const soNo1 = res.response.data.result.currentInning;
      const so1 = await m.Inning.findOne({ matchId: id, inningNumber: soNo1 }).lean();
      const batSO1 = String(so1.battingTeamId) === String(teamId(sp.a)) ? sp.a : sp.b;
      const bowlSO1 = batSO1 === sp.a ? sp.b : sp.a;
      const soPlan = (n: number, bat: string, bowl: string, extra: any) => ({
        ...planFor(id, rules, n, bat, bowl, 't10', { label: `${tname(bat).code} super over`, ...extra }),
        type: 'super_over', batters: xi(bat).slice(0, 3), bowlers: [teamPlayers.get(bowl)![n % 2 ? 8 : 9].id],
      });
      const s1 = await playInning(ctx, soPlan(soNo1, batSO1, bowlSO1, { seed: `${seed}:so1`, bias: 1.1, capRuns: 14 }) as any);
      const s2 = await playInning(ctx, soPlan(soNo1 + 1, bowlSO1, batSO1, { seed: `${seed}:so2`, bias: 1.4, target: s1.runs + 1 }) as any);
      console.log(`   super over: ${s1.runs} vs ${s2.runs}`);
      await liveMatch.checkMatchConclusion(id.toString());
    }
    const done = await m.Match.findById(id).lean();
    console.log(`   result: ${done.status} — ${done.result?.resultText || 'n/a'}`);
  };

  // ---------- match scenarios -----------------------------------------------------------------
  // India v Australia T20I: completed (chase), completed (defended), LIVE mid-chase, 2 upcoming
  await playMatch({ key: 'it20-1', series: 'ind-aus-t20i', no: 1, a: 'ind', b: 'aus', venue: 'mcg', fmt: 't20i', status: 'completed', offsetHours: -72, label: '1st T20I', biasFirst: 1.0, biasSecond: 1.35 });
  await playMatch({ key: 'it20-2', series: 'ind-aus-t20i', no: 2, a: 'aus', b: 'ind', venue: 'mcg', fmt: 't20i', status: 'completed', offsetHours: -48, label: '2nd T20I', tossWinner: 'b', elected: 'bowl', biasFirst: 1.25, biasSecond: 0.75 });
  await playMatch({ key: 'it20-3-live', series: 'ind-aus-t20i', no: 3, a: 'ind', b: 'aus', venue: 'wankhede', fmt: 't20i', status: 'live', offsetHours: -2, label: '3rd T20I', liveAt: 86, biasFirst: 1.1, biasSecond: 1.0 });
  await createMatch({ key: 'it20-4', series: 'ind-aus-t20i', no: 4, a: 'aus', b: 'ind', venue: 'wankhede', fmt: 't20i', status: 'scheduled', offsetHours: 26, label: '4th T20I' });
  await createMatch({ key: 'it20-5', series: 'ind-aus-t20i', no: 5, a: 'ind', b: 'aus', venue: 'wankhede', fmt: 't20i', status: 'scheduled', offsetHours: 74, label: '5th T20I' });

  // England v South Africa ODI: completed, LIVE (1st innings in progress), upcoming
  await playMatch({ key: 'odi-1', series: 'eng-rsa-odi', no: 1, a: 'rsa', b: 'eng', venue: 'newlands', fmt: 'odi', status: 'completed', offsetHours: -50, label: '1st ODI', biasFirst: 1.1, biasSecond: 0.8 });
  await playMatch({ key: 'odi-2-live', series: 'eng-rsa-odi', no: 2, a: 'rsa', b: 'eng', venue: 'newlands', fmt: 'odi', status: 'live', offsetHours: -3, label: '2nd ODI', liveAt: -190 });
  await createMatch({ key: 'odi-3', series: 'eng-rsa-odi', no: 3, a: 'eng', b: 'rsa', venue: 'lords', fmt: 'odi', status: 'scheduled', offsetHours: 100, label: '3rd ODI' });

  // NZ v PAK Test: 1st innings complete, 2nd in progress
  await playMatch({ key: 'test-1-live', series: 'nz-pak-test', no: 1, a: 'nz', b: 'pak', venue: 'hagley', fmt: 'test', status: 'live', offsetHours: -30, label: '1st Test, Day 2', liveAt: 220 });
  await createMatch({ key: 'test-2', series: 'nz-pak-test', no: 2, a: 'pak', b: 'nz', venue: 'hagley', fmt: 'test', status: 'scheduled', offsetHours: 24 * 9, label: '2nd Test' });

  // The Hundred: completed, LIVE (set 13 of 2nd innings), upcoming
  await playMatch({ key: 'h-1', series: 'hundred', no: 1, a: 'll', b: 'mh', venue: 'lords', fmt: 'hundred', status: 'completed', offsetHours: -26, label: 'Match 1', biasFirst: 1.0, biasSecond: 1.2 });
  await playMatch({ key: 'h-2-live', series: 'hundred', no: 2, a: 'mh', b: 'll', venue: 'oval', fmt: 'hundred', status: 'live', offsetHours: -1, label: 'Match 2', liveAt: 63 });
  await createMatch({ key: 'h-3', series: 'hundred', no: 3, a: 'll', b: 'mh', venue: 'oval', fmt: 'hundred', status: 'scheduled', offsetHours: 50, label: 'Match 3' });

  // Premier T20 League: 3 results + 1 tie decided by super over (points table built from these), 2 upcoming
  await playMatch({ key: 'l-1', series: 'premier-t20', no: 1, a: 'mm', b: 'dd', venue: 'wankhede', fmt: 't20', status: 'completed', offsetHours: -240, label: 'Match 1', biasSecond: 1.3 });
  await playMatch({ key: 'l-2', series: 'premier-t20', no: 2, a: 'cc', b: 'bb', venue: 'wankhede', fmt: 't20', status: 'completed', offsetHours: -216, label: 'Match 2', biasSecond: 0.8 });
  await playMatch({ key: 'l-3-tie-so', series: 'premier-t20', no: 3, a: 'mm', b: 'cc', venue: 'wankhede', fmt: 't20', status: 'completed', offsetHours: -192, label: 'Match 3', tieThenSuperOver: true });
  await playMatch({ key: 'l-4', series: 'premier-t20', no: 4, a: 'dd', b: 'bb', venue: 'wankhede', fmt: 't20', status: 'completed', offsetHours: -168, label: 'Match 4', biasSecond: 1.25 });
  await createMatch({ key: 'l-5', series: 'premier-t20', no: 5, a: 'mm', b: 'bb', venue: 'wankhede', fmt: 't20', status: 'scheduled', offsetHours: 20, label: 'Match 5' });
  await createMatch({ key: 'l-6', series: 'premier-t20', no: 6, a: 'dd', b: 'cc', venue: 'wankhede', fmt: 't20', status: 'scheduled', offsetHours: 44, label: 'Match 6' });

  // T10 Blast: one completed, two upcoming
  await playMatch({ key: 't10-1', series: 't10-blast', no: 1, a: 'dd', b: 'cc', venue: 'oval', fmt: 't10', status: 'completed', offsetHours: -20, label: 'Match 1', biasSecond: 1.1 });
  await createMatch({ key: 't10-2', series: 't10-blast', no: 2, a: 'cc', b: 'dd', venue: 'oval', fmt: 't10', status: 'scheduled', offsetHours: 8, label: 'Match 2' });
  await createMatch({ key: 't10-3', series: 't10-blast', no: 3, a: 'dd', b: 'cc', venue: 'oval', fmt: 't10', status: 'scheduled', offsetHours: 30, label: 'Match 3' });

  // Upcoming tournament (no data yet)
  await createMatch({ key: 'asia-1', series: 'asia-cup', no: 1, a: 'ind', b: 'pak', venue: 'wankhede', fmt: 'odi', status: 'scheduled', offsetHours: 24 * 61, label: 'Group A' });
  await createMatch({ key: 'asia-2', series: 'asia-cup', no: 2, a: 'sl', b: 'pak', venue: 'wankhede', fmt: 'odi', status: 'scheduled', offsetHours: 24 * 63, label: 'Group A' });

  // Edge cases: legacy completed match with no scorecard, abandoned, cancelled, hidden
  const legacy = await createMatch({ key: 'tri-1-legacy', series: 'tri-series-2025', no: 1, a: 'wi', b: 'sl', venue: 'newlands', fmt: 't20i', status: 'completed', offsetHours: -24 * 390, label: 'Final (no scorecard)' });
  await m.Match.updateOne({ _id: legacy }, { $set: { status: 'completed', matchState: 'normal', result: { resultType: 'normal', winBy: 'wickets', margin: 5, resultText: 'Sri Lanka won by 5 wickets', winnerId: teamId('sl'), winningTeamId: teamId('sl'), losingTeamId: teamId('wi') } } });
  const ab = await createMatch({ key: 'abandoned-1', series: 'eng-rsa-odi', no: 4, a: 'rsa', b: 'eng', venue: 'newlands', fmt: 'odi', status: 'abandoned', offsetHours: -90, label: 'Abandoned (rain)' });
  await m.Match.updateOne({ _id: ab }, { $set: { result: { resultType: 'no_result', winBy: 'no_result', resultText: 'Match abandoned without a ball bowled' } } });
  await createMatch({ key: 'cancelled-1', series: 'nz-pak-test', no: 3, a: 'nz', b: 'pak', venue: 'hagley', fmt: 'test', status: 'cancelled', offsetHours: 24 * 30, label: 'Cancelled' });
  await createMatch({ key: 'hidden-1', series: 'ind-aus-t20i', no: 6, a: 'ind', b: 'aus', venue: 'mcg', fmt: 't20i', status: 'scheduled', offsetHours: 90, label: 'Hidden from public (isNotShowing)', hidden: true });

  // ---------- points table (derived from the simulated league results) ------------------------
  const league = ['l-1', 'l-2', 'l-3-tie-so', 'l-4'];
  const table = new Map<string, any>(['mm', 'dd', 'cc', 'bb'].map((k) => [k, { p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 }]));
  for (const key of league) {
    const mt = await m.Match.findById(matchId(key)).lean();
    const inns = await m.Inning.find({ matchId: matchId(key), type: { $ne: 'super_over' } }).sort({ inningNumber: 1 }).lean();
    if (!mt?.result?.winnerId || inns.length < 2) continue;
    const winner = String(mt.result.winnerId);
    for (const t of ['mm', 'dd', 'cc', 'bb']) {
      const own = inns.find((i: any) => String(i.battingTeamId) === String(teamId(t)));
      const opp = inns.find((i: any) => String(i.bowlingTeamId) === String(teamId(t)));
      if (!own || !opp) continue;
      const row = table.get(t);
      row.p += 1;
      if (winner === String(teamId(t))) { row.w += 1; row.pts += 2; } else row.l += 1;
      if (mt.result.resultType === 'super_over') row.t += 1;
      const fullBalls = (i: any) => (i.isAllOut ? 120 : i.totalBalls);
      row.rf += own.totalRuns; row.bf += fullBalls(own); row.ra += opp.totalRuns; row.ba += fullBalls(opp);
    }
  }
  const standings = [...table.entries()].map(([k, v]) => ({ k, ...v, nrr: v.bf && v.ba ? v.rf / (v.bf / 6) - v.ra / (v.ba / 6) : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
  await m.Points.deleteMany({ seriesId: seriesId('premier-t20') });
  await m.Points.insertMany(standings.map((s, i) => ({
    seriesId: seriesId('premier-t20'), teamId: teamId(s.k), matchFormat: 't20', groupName: 'League Stage', position: i + 1,
    played: s.p, won: s.w, lost: s.l, tied: s.t, noResult: 0, points: s.pts, netRunRate: Number(s.nrr.toFixed(3)),
    for: `${s.rf}/${(s.bf / 6).toFixed(1)}`, against: `${s.ra}/${(s.ba / 6).toFixed(1)}`, qualify: i < 2, updateMode: 'auto',
  })));

  // ---------- rankings -----------------------------------------------------------------------
  await m.Ranking.deleteMany({ cricbuzzId: /^seed-/ });
  const rr = rng('rankings');
  const rankDocs: any[] = [];
  for (const gender of ['men', 'women'] as const) {
    for (const format of ['test', 'odi', 't20'] as const) {
      RANKING_TEAMS.slice().sort(() => rr.next() - 0.5).forEach((k, i) => rankDocs.push({
        type: 'team', gender, format, rank: i + 1, teamName: tname(k).name, teamCode: tname(k).code, name: tname(k).name,
        rating: 125 - i * 6 - Math.floor(rr.next() * 4), points: 4800 - i * 310, matchesPlayed: 30 + Math.floor(rr.next() * 20),
        previousRank: Math.max(1, i + 1 + rr.pick([-1, 0, 0, 1])), cricbuzzId: `seed-team-${gender}-${format}-${k}`, lastUpdated: new Date(),
      }));
      for (const role of ['batting', 'bowling', 'all-rounder'] as const) {
        const pool = allPlayers.filter((p) => (role === 'batting' ? ['batsman', 'wicket-keeper'] : role === 'bowling' ? ['bowler'] : ['all-rounder']).includes(p.role)).slice(0, 10);
        pool.forEach((p, i) => rankDocs.push({
          type: 'player', gender, format, role, rank: i + 1, name: p.name, country: TEAMS.find((t) => t.key === p.teamKey)!.country,
          rating: 880 - i * 14 - Math.floor(rr.next() * 8), points: 880 - i * 14, previousRank: Math.max(1, i + 1 + rr.pick([-1, 0, 1])),
          cricbuzzId: `seed-player-${gender}-${format}-${role}-${p.id}`, lastUpdated: new Date(),
        }));
      }
    }
  }
  await m.Ranking.insertMany(rankDocs);

  await seedContent();

  // series match counters
  for (const s of SERIES) {
    await m.Series.updateOne({ _id: seriesId(s.key) }, { $set: { totalMatches: await m.Match.countDocuments({ seriesId: seriesId(s.key) }) } });
  }

  const count = async (mod: any, q: any = {}) => mod.countDocuments(q);
  console.log('\n✅ Seed complete');
  console.log(`   matches ${await count(m.Match, { slug: /^seed-/ })} · innings ${await count(m.Inning, { matchId: { $in: MATCH_KEYS_ALL.map(matchId) } })} · balls/overs ${await count(m.Over, { matchId: { $in: MATCH_KEYS_ALL.map(matchId) } })} overs · teams ${TEAMS.length} · players ${allPlayers.length}`);
  console.log(created.length ? `   Logins created (shown once): ${created.join('  |  ')}` : '   Seed users already existed (passwords unchanged).');
  console.log('   Remove all seeded data later with:  npm run seed:purge');
  console.log('   Live matches: it20-3-live (T20I), odi-2-live (ODI), test-1-live (Test), h-2-live (The Hundred)');
  await moduleRef.close();
}

function dupOk(e: any) {
  if (e?.code !== 11000 && !(e?.writeErrors || []).every((w: any) => w.code === 11000)) throw e;
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌ Seed failed:', e); process.exit(1); });
