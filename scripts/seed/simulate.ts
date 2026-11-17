/**
 * Ball-by-ball match simulator. Every ball goes through the real ScoreEngineService, so seeded
 * matches have genuine scorecards, over summaries, commentary, partnerships and undo history.
 */
import { Types } from 'mongoose';
import { FormatRules } from '../../src/modules/live-match/match-rules';
import { rng } from './data';

type R = ReturnType<typeof rng>;

export interface SimCtx {
  engine: any; // ScoreEngineService
  models: { match: any; inning: any; batting: any; bowling: any };
  names: Map<string, string>; // playerId -> name
  log: (msg: string) => void;
}

export interface InningPlan {
  matchId: Types.ObjectId;
  inningNumber: number;
  type?: 'regular' | 'super_over';
  battingTeamId: Types.ObjectId;
  bowlingTeamId: Types.ObjectId;
  batters: Types.ObjectId[]; // batting order (XI)
  bowlers: Types.ObjectId[]; // bowling pool (players who can bowl)
  fielders: Types.ObjectId[]; // whole bowling XI
  keeper: Types.ObjectId;
  rules: FormatRules;
  style: 't20' | 'odi' | 'test' | 't10' | 'hundred';
  /** multiplies scoring aggression (>1 = more boundaries, fewer wickets) */
  bias?: number;
  target?: number; // chase target (stop when reached)
  capRuns?: number; // never exceed this total (used to engineer exact ties)
  /** with capRuns: pace the innings so it lands exactly on capRuns (a tie) */
  tieMode?: boolean;
  stopAfterBalls?: number; // leave the innings in progress (live match)
  label: string;
  seed: string;
}

const TABLES: Record<InningPlan['style'], Record<string, number>> = {
  t20: { '0': 30, '1': 30, '2': 7, '3': 1, '4': 12, '6': 8, wide: 4, nb: 1, bye: 1, lb: 1.5, W: 4.5 },
  hundred: { '0': 27, '1': 29, '2': 7, '3': 1, '4': 13, '6': 9, wide: 3, nb: 1, bye: 0.8, lb: 1.2, W: 4.8 },
  t10: { '0': 22, '1': 27, '2': 6, '3': 1, '4': 15, '6': 14, wide: 3, nb: 1, bye: 0.5, lb: 1, W: 6 },
  odi: { '0': 40, '1': 30, '2': 6, '3': 1, '4': 9, '6': 3.5, wide: 2, nb: 0.5, bye: 0.5, lb: 1, W: 3 },
  test: { '0': 62, '1': 22, '2': 4, '3': 0.5, '4': 7.5, '6': 1, wide: 0.3, nb: 0.6, bye: 0.4, lb: 0.8, W: 1.7 },
};

const WICKET_KINDS: [string, number][] = [['bowled', 28], ['caught', 40], ['lbw', 12], ['stumped', 5], ['run_out', 10], ['hit_wicket', 0.5]];

const cost = (o: string, runs: number) => (o === 'wide' || o === 'nb' ? 1 : o === 'bye' || o === 'lb' ? runs : o === 'W' ? 0 : runs);

export interface InningResult { runs: number; wickets: number; balls: number; allOut: boolean }

export async function playInning(ctx: SimCtx, plan: InningPlan): Promise<InningResult> {
  const r: R = rng(plan.seed);
  const { match: matchM, inning: inningM, batting: battingM, bowling: bowlingM } = ctx.models;
  const mid = plan.matchId.toString();
  const bpo = plan.rules.ballsPerOver;
  const ballLimit = plan.type === 'super_over' ? plan.rules.superOverBalls : plan.rules.maxBallsPerInning;
  const wicketLimit = plan.type === 'super_over' ? plan.rules.superOverWickets : plan.rules.maxWickets;

  // --- inning + openers + first bowler -----------------------------------------------------
  let inning = await inningM.findOne({ matchId: plan.matchId, inningNumber: plan.inningNumber });
  if (!inning) {
    inning = await inningM.create({
      matchId: plan.matchId,
      inningNumber: plan.inningNumber,
      type: plan.type || 'regular',
      battingTeamId: plan.battingTeamId,
      bowlingTeamId: plan.bowlingTeamId,
      target: plan.target,
      startTime: new Date(),
    });
  } else if (plan.target) {
    await inningM.updateOne({ _id: inning._id }, { $set: { target: plan.target } });
  }
  const inningId = inning._id;

  await matchM.updateOne({ _id: plan.matchId }, { $set: { currentInning: plan.inningNumber, status: 'live', matchState: 'normal' } });

  let nextBatter = 2;
  const addBatter = async (pos: number, playerId: Types.ObjectId, onStrike: boolean) =>
    battingM.create({ matchId: plan.matchId, inningId, playerId, teamId: plan.battingTeamId, battingPosition: pos, isOnStrike: onStrike, isVisible: true });

  await addBatter(1, plan.batters[0], true);
  await addBatter(2, plan.batters[1], false);

  let bowlingOrder = 0;
  const bowlerDocs = new Map<string, any>();
  const ensureBowler = async (playerId: Types.ObjectId) => {
    const key = playerId.toString();
    if (!bowlerDocs.has(key)) {
      bowlingOrder += 1;
      bowlerDocs.set(key, await bowlingM.create({ matchId: plan.matchId, inningId, playerId, teamId: plan.bowlingTeamId, bowlingOrder, isCurrentBowler: false }));
    }
    return bowlerDocs.get(key);
  };

  let prevBowler: string | null = null;
  let consecutive = 0;
  const pickBowler = async (): Promise<Types.ObjectId> => {
    const rows = await bowlingM.find({ inningId }).lean();
    const balls = new Map<string, number>(rows.map((b: any) => [b.playerId.toString(), b.balls || 0]));
    const quota = plan.type === 'super_over' ? 0 : plan.rules.maxBallsPerBowler;
    let pool = plan.bowlers.filter((b) => (quota === 0 || (balls.get(b.toString()) || 0) + bpo <= quota));
    const notPrev = pool.filter((b) => b.toString() !== prevBowler);
    // The Hundred: the same bowler may deliver two consecutive 5-ball sets
    const mayRepeat = plan.rules.maxConsecutiveOvers > 1 && consecutive < plan.rules.maxConsecutiveOvers && prevBowler && pool.some((b) => b.toString() === prevBowler) && r.next() < 0.45;
    if (mayRepeat) return plan.bowlers.find((b) => b.toString() === prevBowler)!;
    if (notPrev.length) pool = notPrev;
    if (!pool.length) pool = plan.bowlers.filter((b) => b.toString() !== prevBowler); // quota exhausted: relax (never in valid squads)
    // prefer bowlers with fewer balls so quotas are spread out realistically
    pool.sort((a, b) => (balls.get(a.toString()) || 0) - (balls.get(b.toString()) || 0));
    return pool[Math.min(pool.length - 1, Math.floor(r.next() * Math.min(3, pool.length)))];
  };

  const setCurrentBowler = async (playerId: Types.ObjectId) => {
    const doc = await ensureBowler(playerId);
    await bowlingM.updateMany({ inningId }, { $set: { isCurrentBowler: false } });
    await bowlingM.updateOne({ _id: doc._id }, { $set: { isCurrentBowler: true } });
    await inningM.updateOne({ _id: inningId }, { $set: { currentBowlerId: playerId } });
    consecutive = prevBowler === playerId.toString() ? consecutive + 1 : 1;
    prevBowler = playerId.toString();
  };

  await inningM.updateOne({ _id: inningId }, { $set: { currentStrikerId: plan.batters[0], currentNonStrikerId: plan.batters[1] } });
  await setCurrentBowler(await pickBowler());

  // --- ball loop -----------------------------------------------------------------------------
  const table = TABLES[plan.style];
  const bias = plan.bias ?? 1;
  const send = async (ev: any) => {
    try {
      return await ctx.engine.handleEvent(mid, ev);
    } catch (e: any) {
      throw new Error(`[${plan.label}] engine rejected ${JSON.stringify(ev)}: ${e.message}`);
    }
  };

  let overEnded = false;
  let guard = 0;
  for (;;) {
    if (++guard > 3000) throw new Error(`[${plan.label}] runaway simulation`);
    const cur = await inningM.findById(inningId).lean();
    const { totalRuns: runs, totalWickets: wkts, totalBalls: balls } = cur;

    if (wkts >= wicketLimit) break;
    if (ballLimit > 0 && balls >= ballLimit) break;
    if (plan.target && runs >= plan.target) break;
    if (plan.stopAfterBalls !== undefined && balls >= plan.stopAfterBalls) break;

    // end of over
    if (balls > 0 && balls % bpo === 0 && !overEnded) {
      await send({ type: 'OVER_END' });
      overEnded = true;
      if (ballLimit === 0 || balls < ballLimit) await setCurrentBowler(await pickBowler());
      continue;
    }

    // choose an outcome
    const remaining = plan.capRuns !== undefined ? plan.capRuns - runs : Infinity;
    const weights: [string, number][] = Object.entries(table).map(([k, w]) => {
      let wt = w;
      if (k === '4' || k === '6') wt *= bias;
      if (k === 'W') wt /= Math.sqrt(bias);
      const runVal = k === 'W' || k === 'wide' || k === 'nb' || k === 'bye' || k === 'lb' ? 1 : Number(k);
      if (remaining !== Infinity && cost(k, runVal) > remaining) wt = 0;
      return [k, wt];
    });
    if (plan.tieMode && plan.capRuns !== undefined && ballLimit > 0) {
      const need = plan.capRuns - runs;
      const ballsLeft = Math.max(1, ballLimit - balls);
      const pace = need / ballsLeft;
      for (const w of weights) {
        const k = w[0];
        if (need <= 0) { w[1] = k === '0' ? 1 : 0; continue; }          // target met: just see out the overs
        if (k === 'W') w[1] = wkts >= 7 || pace > 1.0 ? 0 : w[1] * 0.3;  // keep wickets in hand while chasing
        if (pace > 2.4 && (k === '0' || k === 'wide' || k === 'nb' || k === 'bye' || k === 'lb')) w[1] = k === 'wide' || k === 'nb' ? w[1] : 0;
        if (pace > 2.4 && k === '1') w[1] *= 0.2;
        if (pace > 1.3 && (k === '4' || k === '6')) w[1] *= 3;
        if (pace > 1.3 && k === '0') w[1] *= 0.2;
        if (pace < 0.7 && (k === '4' || k === '6')) w[1] *= 0.2;
        if (pace < 0.7 && k === '0') w[1] *= 3;
      }
    }
    // if capped and only dots are possible, allow wickets to be skipped so the over can finish
    const outcome = r.weighted(weights.filter(([, w]) => w > 0).length ? weights : [['0', 1]]);

    const cs = cur.currentStrikerId;
    const ns = cur.currentNonStrikerId;
    let ev: any;
    let dismissed: Types.ObjectId | null = null;
    let wicketKind = '';

    switch (outcome) {
      case 'wide':
        ev = r.next() < 0.04 && plan.style !== 'test' ? { type: 'WIDE', runs: 0, extras: 1, triggerWicket: true } : { type: 'WIDE', runs: 0, extras: 1 };
        break;
      case 'nb': ev = { type: 'NO_BALL', runs: r.weighted([[0, 6], [1, 2], [4, 1], [6, 0.5]] as [number, number][]), extras: 1 }; break;
      case 'bye': ev = { type: 'BYE', runs: r.weighted([[1, 6], [2, 1], [4, 1]] as [number, number][]) }; break;
      case 'lb': ev = { type: 'LEG_BYE', runs: r.weighted([[1, 6], [2, 1], [4, 0.5]] as [number, number][]) }; break;
      case 'W': {
        wicketKind = r.weighted(WICKET_KINDS);
        const fielder = r.pick(plan.fielders.filter((f) => f.toString() !== prevBowler));
        ev = { type: 'WICKET', wicketType: wicketKind, runs: 0 };
        dismissed = cs;
        if (wicketKind === 'caught') ev.helperId = fielder.toString();
        if (wicketKind === 'stumped') ev.helperId = plan.keeper.toString();
        if (wicketKind === 'run_out') {
          ev.helperId = fielder.toString();
          ev.runs = remaining === Infinity && r.next() < 0.4 ? 1 : 0;
          if (r.next() < 0.35) { ev.playerId = ns.toString(); dismissed = ns; }
        }
        break;
      }
      default: ev = { type: 'RUN', runs: Number(outcome) };
    }

    const result = await send(ev);
    overEnded = false;

    // composite "wide + stumped/run out"
    if (result?.requiresWicketSelection) {
      const kind = r.pick(['stumped', 'run_out']);
      const wk = { type: 'WICKET', runs: 0, wicketType: kind, isComposite: true, ...(kind === 'stumped' ? { helperId: plan.keeper.toString() } : {}) };
      await send(wk);
      dismissed = cs;
      wicketKind = kind;
    }

    // bring in the next batter after a dismissal
    if (dismissed) {
      const after = await inningM.findById(inningId).lean();
      const out = await battingM.findOne({ inningId, playerId: dismissed });
      const bowlerName = ctx.names.get(String(after.currentBowlerId)) || '';
      const fielderName = out?.fielderId ? ctx.names.get(String(out.fielderId)) || '' : '';
      const text: Record<string, string> = {
        bowled: `b ${bowlerName}`,
        lbw: `lbw b ${bowlerName}`,
        caught: fielderName === bowlerName ? `c & b ${bowlerName}` : `c ${fielderName} b ${bowlerName}`,
        stumped: `st ${ctx.names.get(String(plan.keeper))} b ${bowlerName}`,
        run_out: `run out (${fielderName})`,
        hit_wicket: `hit wicket b ${bowlerName}`,
      };
      await battingM.updateOne({ inningId, playerId: dismissed }, { $set: { dismissalText: text[wicketKind] || 'out', isOnStrike: false } });

      if (after.totalWickets < wicketLimit && nextBatter < plan.batters.length) {
        const incoming = plan.batters[nextBatter];
        nextBatter += 1;
        await addBatter(nextBatter, incoming, String(dismissed) === String(after.currentStrikerId));
        const field = String(dismissed) === String(after.currentStrikerId) ? 'currentStrikerId' : 'currentNonStrikerId';
        await inningM.updateOne({ _id: inningId }, { $set: { [field]: incoming } });
      }
    }
  }

  // closing over summary for completed overs, then mark the inning
  const fin = await inningM.findById(inningId).lean();
  if (plan.stopAfterBalls === undefined && fin.totalBalls > 0 && fin.totalBalls % bpo === 0 && !overEnded) {
    try { await ctx.engine.handleEvent(mid, { type: 'OVER_END' }); } catch { /* final over already closed */ }
  }
  const complete = plan.stopAfterBalls === undefined || fin.totalBalls < plan.stopAfterBalls;
  const allOut = fin.totalWickets >= wicketLimit;
  if (complete) {
    await inningM.updateOne({ _id: inningId }, { $set: { isCompleted: true, isAllOut: allOut, endTime: new Date(), totalOvers: Math.floor(fin.totalBalls / bpo) } });
  } else {
    await inningM.updateOne({ _id: inningId }, { $set: { totalOvers: Math.floor(fin.totalBalls / bpo) } });
  }
  const final = await inningM.findById(inningId).lean();
  ctx.log(`   ${plan.label}: ${final.totalRuns}/${final.totalWickets} (${final.totalBalls} balls)${complete ? '' : ' — in progress'}`);
  return { runs: final.totalRuns, wickets: final.totalWickets, balls: final.totalBalls, allOut };
}
