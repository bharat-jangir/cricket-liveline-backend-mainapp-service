import { getRules, formatOvers, inningBallLimit, inningWicketLimit, bowlerCreditedDismissal, formatDefaults } from '../../match-rules';
import { ScoreEngineService } from '../score-engine.service';

describe('format rules', () => {
    it('T20: 6 balls x 20 overs, 24 balls per bowler, no back-to-back overs', () => {
        const r = getRules({ matchFormat: 't20', ballsPerOver: 6, oversPerInning: 20 });
        expect(r.maxBallsPerInning).toBe(120);
        expect(r.maxBallsPerBowler).toBe(24);
        expect(r.maxConsecutiveOvers).toBe(1);
        expect(r.powerplayBalls).toBe(36);
    });

    it('The Hundred: 5-ball sets x 20 = 100 balls, 20 balls per bowler, up to 2 consecutive sets', () => {
        // even when the stored defaults are the schema's 6 x 20
        const r = getRules({ matchFormat: 'hundred', ballsPerOver: 6, oversPerInning: 20 });
        expect(r.ballsPerOver).toBe(5);
        expect(r.maxBallsPerInning).toBe(100);
        expect(r.maxBallsPerBowler).toBe(20);
        expect(r.maxConsecutiveOvers).toBe(2);
        expect(r.powerplayBalls).toBe(25);
        expect(r.superOverBalls).toBe(5);
        expect(formatOvers(47, r)).toBe('47');
    });

    it('T10 and ODI limits; Test is unlimited', () => {
        expect(getRules({ matchFormat: 't10' }).maxBallsPerBowler).toBe(12);
        expect(getRules({ matchFormat: 'odi', oversPerInning: 50 }).maxBallsPerBowler).toBe(60);
        const test = getRules({ matchFormat: 'test' });
        expect(test.maxBallsPerInning).toBe(0);
        expect(test.maxBallsPerBowler).toBe(0);
    });

    it('explicit match bowler limit overrides the format default', () => {
        expect(getRules({ matchFormat: 't20', maxBowlerLimit: 2 }).maxBallsPerBowler).toBe(12);
    });

    it('super overs use their own ball/wicket limits', () => {
        const t20 = getRules({ matchFormat: 't20' });
        expect(inningBallLimit(t20, { type: 'super_over' })).toBe(6);
        expect(inningWicketLimit(t20, { type: 'super_over' })).toBe(2);
        expect(inningBallLimit(getRules({ matchFormat: 'hundred' }), { type: 'super_over' })).toBe(5);
    });

    it('format defaults persisted on create', () => {
        expect(formatDefaults('hundred')).toEqual({ ballsPerOver: 5, oversPerInning: 20, maxBowlerLimit: 4 });
        expect(formatDefaults('100B').ballsPerOver).toBe(5);
    });

    it('bowler wicket credit by dismissal', () => {
        ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'caught and bowled', 'wicket'].forEach(t => expect(bowlerCreditedDismissal(t)).toBe(true));
        ['run_out', 'run out', 'retired', 'obstructing_the_field', 'handled_ball'].forEach(t => expect(bowlerCreditedDismissal(t)).toBe(false));
    });
});

describe('engine guards', () => {
    const svc: any = new ScoreEngineService(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    const base = (over: Partial<any> = {}) => ({
        match: { matchFormat: 't20', status: 'live', ballsPerOver: 6 },
        inning: { totalBalls: 0, totalWickets: 0, currentStrikerId: 'a', currentNonStrikerId: 'b', currentBowlerId: 'c', type: 'regular' },
        striker: { playerId: 'a' }, nonStriker: { playerId: 'b' }, bowler: { balls: 0, playerId: { name: 'X' } },
        currentOverBalls: [], ...over,
    });

    it('rejects a delivery after the innings is full', () => {
        const st: any = base(); st.inning.totalBalls = 120;
        expect(() => svc.validateEventAllowed(st, { type: 'RUN', runs: 1 })).toThrow(/all 120 balls/);
    });

    it('The Hundred innings is full after 100 balls', () => {
        const st: any = base({ match: { matchFormat: 'hundred', status: 'live' } }); st.inning.totalBalls = 100;
        expect(() => svc.validateEventAllowed(st, { type: 'RUN', runs: 1 })).toThrow(/100 balls/);
        st.inning.totalBalls = 99;
        expect(() => svc.validateEventAllowed(st, { type: 'RUN', runs: 1 })).not.toThrow();
    });

    it('rejects a bowler over quota (T20 24 balls, Hundred 20 balls)', () => {
        const t20: any = base(); t20.bowler.balls = 24;
        expect(() => svc.validateEventAllowed(t20, { type: 'RUN' })).toThrow(/maximum 24 balls/);
        const h: any = base({ match: { matchFormat: 'hundred', status: 'live' } }); h.bowler.balls = 20;
        expect(() => svc.validateEventAllowed(h, { type: 'WIDE', extras: 1 })).toThrow(/maximum 20 balls/);
    });

    it('rejects scoring when all out, match completed, or players unset', () => {
        const out: any = base(); out.inning.totalWickets = 10;
        expect(() => svc.validateEventAllowed(out, { type: 'RUN' })).toThrow(/all out/);
        const done: any = base(); done.match.status = 'completed';
        expect(() => svc.validateEventAllowed(done, { type: 'RUN' })).toThrow(/completed/);
        const nob: any = base(); nob.inning.currentBowlerId = undefined;
        expect(() => svc.validateEventAllowed(nob, { type: 'RUN' })).toThrow(/Select striker/);
    });

    it('rejects the next ball while a dismissed batter is still at the crease', () => {
        const st: any = base(); st.striker.isOut = true;
        expect(() => svc.validateEventAllowed(st, { type: 'RUN' })).toThrow(/incoming batter/);
    });

    it('super over allows 6 balls (T20) and 2 wickets', () => {
        const st: any = base(); st.inning.type = 'super_over'; st.inning.totalBalls = 6;
        expect(() => svc.validateEventAllowed(st, { type: 'RUN' })).toThrow(/Super Over/);
        const w: any = base(); w.inning.type = 'super_over'; w.inning.totalWickets = 2;
        expect(() => svc.validateEventAllowed(w, { type: 'RUN' })).toThrow(/all out/);
    });

    it('over end only when the over is complete (5 balls in The Hundred)', () => {
        const h: any = base({ match: { matchFormat: 'hundred', status: 'live' } }); h.inning.totalBalls = 5;
        expect(() => svc.validateEventAllowed(h, { type: 'OVER_END' })).not.toThrow();
        h.inning.totalBalls = 4;
        expect(() => svc.validateEventAllowed(h, { type: 'OVER_END' })).toThrow(/not complete/);
    });

    it('run-out of the non-striker resolves the dismissed batter; no-ball wickets never credit the bowler', () => {
        const st: any = base();
        const ev: any = { type: 'WICKET', playerId: 'b', wicketType: 'run_out', runs: 1 };
        svc.validateEventAllowed(st, ev);
        expect(ev.dismissedPlayerId).toBe('b');
        expect(svc.creditsBowler({ type: 'WICKET', wicketType: 'bowled', parentType: 'NO_BALL' })).toBe(false);
        expect(svc.creditsBowler({ type: 'WICKET', wicketType: 'stumped', parentType: 'WIDE' })).toBe(true);
        expect(svc.creditsBowler({ type: 'WICKET', wicketType: 'run_out' })).toBe(false);
    });
});
