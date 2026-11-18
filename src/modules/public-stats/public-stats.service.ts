import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match } from '../../entities/match.entity';
import { BattingScorecard } from '../../entities/batting-scorecard.entity';
import { BowlingScorecard } from '../../entities/bowling-scorecard.entity';
import { Player } from '../../entities/player.entity';

const isId = (v: any) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

/** Mobile/web format keys -> stored matchFormat values */
function formatsFor(format?: string): string[] | null {
  const f = String(format || '').toLowerCase();
  if (!f || f === 'all') return null;
  if (f === 't20' || f === 't20i') return ['t20', 't20i'];
  if (f === 'hundred' || f === '100b') return ['hundred'];
  return [f];
}

const num = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '0.00');

@Injectable()
export class PublicStatsService {
  constructor(
    @InjectModel(Match.name) private readonly matchModel: Model<any>,
    @InjectModel(BattingScorecard.name) private readonly battingModel: Model<any>,
    @InjectModel(BowlingScorecard.name) private readonly bowlingModel: Model<any>,
    @InjectModel(Player.name) private readonly playerModel: Model<any>,
  ) {}

  /** Career stats for one player, computed from real scorecards (optionally one format). */
  async playerStats(playerId: string, format?: string) {
    if (!isId(playerId)) return { status: false, statusCode: 400, userMessage: 'Invalid player id', data: null };
    const pid = new Types.ObjectId(playerId);
    const formats = formatsFor(format);

    const lookup = [
      { $lookup: { from: 'matches', localField: 'matchId', foreignField: '_id', as: 'm' } },
      { $unwind: '$m' },
      ...(formats ? [{ $match: { 'm.matchFormat': { $in: formats } } }] : []),
    ];

    const [bat, bowl, matchIds] = await Promise.all([
      this.battingModel.aggregate([
        { $match: { playerId: pid } },
        ...lookup,
        { $match: { $or: [{ balls: { $gt: 0 } }, { isOut: true }, { runs: { $gt: 0 } }] } },
        {
          $group: {
            _id: null,
            innings: { $sum: 1 },
            notOuts: { $sum: { $cond: ['$isOut', 0, 1] } },
            runs: { $sum: '$runs' },
            balls: { $sum: '$balls' },
            fours: { $sum: '$fours' },
            sixes: { $sum: '$sixes' },
            highScore: { $max: '$runs' },
            hundreds: { $sum: { $cond: [{ $gte: ['$runs', 100] }, 1, 0] } },
            fifties: { $sum: { $cond: [{ $and: [{ $gte: ['$runs', 50] }, { $lt: ['$runs', 100] }] }, 1, 0] } },
            matches: { $addToSet: '$matchId' },
          },
        },
      ]),
      this.bowlingModel.aggregate([
        { $match: { playerId: pid, balls: { $gt: 0 } } },
        ...lookup,
        {
          $group: {
            _id: null,
            innings: { $sum: 1 },
            balls: { $sum: '$balls' },
            runs: { $sum: '$runs' },
            wickets: { $sum: '$wickets' },
            maidens: { $sum: '$maidens' },
            fiveWickets: { $sum: { $cond: [{ $gte: ['$wickets', 5] }, 1, 0] } },
            matches: { $addToSet: '$matchId' },
          },
        },
      ]),
      Promise.resolve(null),
    ]);

    const b = bat[0];
    const w = bowl[0];
    const matches = new Set<string>([...(b?.matches || []), ...(w?.matches || [])].map(String));

    // Best bowling figures: most wickets, then fewest runs
    let bestBowling = '-';
    if (w) {
      const best = await this.bowlingModel.aggregate([
        { $match: { playerId: pid, balls: { $gt: 0 } } },
        ...lookup,
        { $sort: { wickets: -1, runs: 1 } },
        { $limit: 1 },
        { $project: { wickets: 1, runs: 1 } },
      ]);
      if (best[0]) bestBowling = `${best[0].wickets}/${best[0].runs}`;
    }

    const player: any = await this.playerModel.findById(pid).select('role').lean();
    const dismissals = b ? b.innings - b.notOuts : 0;
    const battingAvg = b ? (dismissals > 0 ? b.runs / dismissals : b.runs) : 0;
    const bowlingAvg = w && w.wickets > 0 ? w.runs / w.wickets : 0;
    const bowlerFirst = player?.role === 'bowler';

    const stats = {
      matches: String(matches.size),
      innings: String(b?.innings || 0),
      runs: String(b?.runs || 0),
      balls: String(b?.balls || 0),
      average: num(bowlerFirst ? bowlingAvg : battingAvg),
      battingAverage: num(battingAvg),
      strikeRate: b && b.balls ? num((b.runs / b.balls) * 100) : '0.00',
      highScore: String(b?.highScore ?? 0),
      hundreds: String(b?.hundreds || 0),
      fifties: String(b?.fifties || 0),
      fours: String(b?.fours || 0),
      sixes: String(b?.sixes || 0),
      wickets: String(w?.wickets || 0),
      bowlingAverage: num(bowlingAvg),
      economy: w && w.balls ? num((w.runs / w.balls) * 6) : '0.00',
      bestBowling,
      fiveWickets: String(w?.fiveWickets || 0),
    };
    return { status: true, statusCode: 200, data: { result: stats } };
  }

  /** Series leaderboards in the shape the apps render: { Batting: [...], Bowling: [...], Fielding: [...] } */
  async seriesLeaders(seriesId: string) {
    if (!isId(seriesId)) return { status: false, statusCode: 400, userMessage: 'Invalid series id', data: null };
    const matchIds = await this.matchModel.find({ seriesId: new Types.ObjectId(seriesId) }).distinct('_id');
    if (!matchIds.length) return { status: true, statusCode: 200, data: { result: { Batting: [], Bowling: [], Fielding: [] } } };
    const inSeries = { matchId: { $in: matchIds } };

    const [runs, sixes, fours, wickets, economy, catches] = await Promise.all([
      this.battingModel.aggregate([{ $match: inSeries }, { $group: { _id: '$playerId', v: { $sum: '$runs' } } }, { $match: { v: { $gt: 0 } } }, { $sort: { v: -1 } }, { $limit: 5 }]),
      this.battingModel.aggregate([{ $match: inSeries }, { $group: { _id: '$playerId', v: { $sum: '$sixes' } } }, { $match: { v: { $gt: 0 } } }, { $sort: { v: -1 } }, { $limit: 5 }]),
      this.battingModel.aggregate([{ $match: inSeries }, { $group: { _id: '$playerId', v: { $sum: '$fours' } } }, { $match: { v: { $gt: 0 } } }, { $sort: { v: -1 } }, { $limit: 5 }]),
      this.bowlingModel.aggregate([{ $match: inSeries }, { $group: { _id: '$playerId', v: { $sum: '$wickets' } } }, { $match: { v: { $gt: 0 } } }, { $sort: { v: -1 } }, { $limit: 5 }]),
      this.bowlingModel.aggregate([
        { $match: inSeries },
        { $group: { _id: '$playerId', runs: { $sum: '$runs' }, balls: { $sum: '$balls' } } },
        { $match: { balls: { $gte: 12 } } },
        { $project: { v: { $divide: ['$runs', { $divide: ['$balls', 6] }] } } },
        { $sort: { v: 1 } },
        { $limit: 5 },
      ]),
      this.battingModel.aggregate([{ $match: { ...inSeries, dismissalType: 'caught', fielderId: { $ne: null } } }, { $group: { _id: '$fielderId', v: { $sum: 1 } } }, { $sort: { v: -1 } }, { $limit: 5 }]),
    ]);

    const ids = [...runs, ...sixes, ...fours, ...wickets, ...economy, ...catches].map((r) => r._id).filter(Boolean);
    const players = await this.playerModel.find({ _id: { $in: ids } }).select('name fullName country image').lean();
    const byId = new Map<string, any>(players.map((p: any) => [String(p._id), p]));

    const rows = (title: string, metric: string, list: any[], fmt: (v: number) => string) =>
      list.map((r, i) => {
        const p = byId.get(String(r._id));
        return {
          id: `${title}-${r._id}`,
          playerId: String(r._id),
          rank: i + 1,
          title,
          metric,
          player: p?.fullName || p?.name || 'Unknown',
          team: p?.country || '',
          image: p?.image,
          value: fmt(r.v),
        };
      });
    const int = (v: number) => String(v);
    return {
      status: true,
      statusCode: 200,
      data: {
        result: {
          Batting: [...rows('Most Runs', 'Runs', runs, int), ...rows('Most Sixes', 'Sixes', sixes, int), ...rows('Most Fours', 'Fours', fours, int)],
          Bowling: [...rows('Most Wickets', 'Wickets', wickets, int), ...rows('Best Economy', 'Econ', economy, (v) => v.toFixed(2))],
          Fielding: rows('Most Catches', 'Catches', catches, int),
        },
      },
    };
  }
}
