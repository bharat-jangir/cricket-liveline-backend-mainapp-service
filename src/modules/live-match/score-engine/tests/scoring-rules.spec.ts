import { ScoreEngineService } from '../score-engine.service';

describe('ScoreEngineService - scoring rules helpers', () => {
    const svc: any = new ScoreEngineService(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any);

    it('economy uses balls, not decimal overs (1.3 overs = 9 balls)', () => {
        expect(svc.calcEconomy(15, 9)).toBeCloseTo(10, 5);
        expect(svc.calcEconomy(0, 0)).toBe(0);
    });

    it('byes, leg-byes and penalties are not charged to the bowler', () => {
        expect(svc.bowlerCharge({ type: 'BYE', runs: 4 })).toBe(0);
        expect(svc.bowlerCharge({ type: 'LEG_BYE', runs: 2 })).toBe(0);
        expect(svc.bowlerCharge({ type: 'PENALTY', extras: 5 })).toBe(0);
    });

    it('no-ball + bye charges only the no-ball; wide + runs charges everything', () => {
        expect(svc.bowlerCharge({ type: 'NO_BALL', runs: 0, extras: 3, isExtraType: 'BYE' })).toBe(1);
        expect(svc.bowlerCharge({ type: 'NO_BALL', runs: 4, extras: 1 })).toBe(5);
        expect(svc.bowlerCharge({ type: 'WIDE', runs: 0, extras: 3 })).toBe(3);
    });

    it('strike rotates on wide/no-ball-bye overruns but not on penalties', () => {
        expect(svc.runsRun({ type: 'WIDE', extras: 2 }) % 2).toBe(1);
        expect(svc.runsRun({ type: 'WIDE', extras: 1 }) % 2).toBe(0);
        expect(svc.runsRun({ type: 'NO_BALL', extras: 2, isExtraType: 'BYE' }) % 2).toBe(1);
        expect(svc.runsRun({ type: 'PENALTY', extras: 5 })).toBe(0);
        expect(svc.runsRun({ type: 'RUN', runs: 3 })).toBe(3);
    });

    it('dot balls: byes count, penalties and extras with runs do not', () => {
        expect(svc.isDotForBowler({ type: 'BYE', runs: 1 })).toBe(true);
        expect(svc.isDotForBowler({ type: 'PENALTY', extras: 5 })).toBe(false);
        expect(svc.isDotForBowler({ type: 'WIDE', extras: 1 })).toBe(false);
        expect(svc.isDotForBowler({ type: 'WICKET', runs: 0 })).toBe(true);
        expect(svc.isDotForBowler({ type: 'WICKET', runs: 0, isComposite: true })).toBe(false);
    });
});
