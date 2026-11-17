/**
 * Central place for format-specific cricket rules.
 *
 * "Over" is the scoring unit used throughout the app. For The Hundred an "over" is a
 * 5-ball set: an innings is 20 sets (100 balls), and a bowler delivers either one set
 * (5 balls) or two consecutive sets (10 balls) before changing, up to 20 balls in total.
 */
export interface FormatRules {
  format: string;
  ballsPerOver: number;
  /** 0 = unlimited (Test) */
  oversPerInning: number;
  /** Max legal balls per innings, 0 = unlimited */
  maxBallsPerInning: number;
  /** Max legal balls per bowler, 0 = unlimited */
  maxBallsPerBowler: number;
  /** How many consecutive "overs" (sets) the same bowler may deliver */
  maxConsecutiveOvers: number;
  powerplayBalls: number;
  superOverBalls: number;
  superOverWickets: number;
  maxWickets: number;
  /** Hundred is scored/displayed in balls, not overs.balls */
  displayInBalls: boolean;
  /** Format supports a Super Over to break ties */
  hasSuperOver: boolean;
}

const BASE: Record<string, Omit<FormatRules, 'format' | 'maxBallsPerInning' | 'maxBallsPerBowler'> & { bowlerOvers: number }> = {
  t20: { ballsPerOver: 6, oversPerInning: 20, bowlerOvers: 4, maxConsecutiveOvers: 1, powerplayBalls: 36, superOverBalls: 6, superOverWickets: 2, maxWickets: 10, displayInBalls: false, hasSuperOver: true },
  t20i: { ballsPerOver: 6, oversPerInning: 20, bowlerOvers: 4, maxConsecutiveOvers: 1, powerplayBalls: 36, superOverBalls: 6, superOverWickets: 2, maxWickets: 10, displayInBalls: false, hasSuperOver: true },
  t10: { ballsPerOver: 6, oversPerInning: 10, bowlerOvers: 2, maxConsecutiveOvers: 1, powerplayBalls: 18, superOverBalls: 6, superOverWickets: 2, maxWickets: 10, displayInBalls: false, hasSuperOver: true },
  odi: { ballsPerOver: 6, oversPerInning: 50, bowlerOvers: 10, maxConsecutiveOvers: 1, powerplayBalls: 60, superOverBalls: 6, superOverWickets: 2, maxWickets: 10, displayInBalls: false, hasSuperOver: false },
  test: { ballsPerOver: 6, oversPerInning: 0, bowlerOvers: 0, maxConsecutiveOvers: 1, powerplayBalls: 0, superOverBalls: 6, superOverWickets: 2, maxWickets: 10, displayInBalls: false, hasSuperOver: false },
  // 20 sets of 5 balls; bowler: 5 or 10 consecutive balls, max 20 balls; powerplay = first 25 balls
  hundred: { ballsPerOver: 5, oversPerInning: 20, bowlerOvers: 4, maxConsecutiveOvers: 2, powerplayBalls: 25, superOverBalls: 5, superOverWickets: 2, maxWickets: 10, displayInBalls: true, hasSuperOver: true },
};

export function normalizeFormat(f?: string): string {
  const lower = String(f || 't20').toLowerCase();
  if (lower === '100b') return 'hundred';
  return BASE[lower] ? lower : 't20';
}

/** Defaults to persist on a match when it is created / its format changes. */
export function formatDefaults(format?: string) {
  const b = BASE[normalizeFormat(format)];
  return { ballsPerOver: b.ballsPerOver, oversPerInning: b.oversPerInning, maxBowlerLimit: b.bowlerOvers };
}

/**
 * Resolve effective rules. The Hundred always uses 5-ball sets; for other formats an
 * explicit match.ballsPerOver / oversPerInning / maxBowlerLimit wins over the format default.
 */
export function getRules(match: any): FormatRules {
  const format = normalizeFormat(match?.matchFormat);
  const b = BASE[format];
  const ballsPerOver = format === 'hundred' ? 5 : (match?.ballsPerOver > 0 ? match.ballsPerOver : b.ballsPerOver);
  const oversPerInning = format === 'hundred' ? 20 : (format === 'test' ? 0 : (match?.oversPerInning > 0 ? match.oversPerInning : b.oversPerInning));
  const bowlerOvers = match?.maxBowlerLimit > 0 ? match.maxBowlerLimit : b.bowlerOvers;
  return {
    format,
    ballsPerOver,
    oversPerInning,
    maxBallsPerInning: oversPerInning * ballsPerOver,
    // Hundred: hard cap of 20 balls per bowler regardless of any stored value
    maxBallsPerBowler: format === 'test' ? 0 : format === 'hundred' ? 20 : bowlerOvers * ballsPerOver,
    maxConsecutiveOvers: b.maxConsecutiveOvers,
    powerplayBalls: b.powerplayBalls,
    superOverBalls: b.superOverBalls,
    superOverWickets: b.superOverWickets,
    maxWickets: b.maxWickets,
    displayInBalls: b.displayInBalls,
    hasSuperOver: b.hasSuperOver,
  };
}

/** Balls limit for a specific inning (super overs have their own limit). */
export function inningBallLimit(rules: FormatRules, inning: any): number {
  return inning?.type === 'super_over' ? rules.superOverBalls : rules.maxBallsPerInning;
}

export function inningWicketLimit(rules: FormatRules, inning: any): number {
  return inning?.type === 'super_over' ? rules.superOverWickets : rules.maxWickets;
}

/** "12.3" style, or plain ball count for The Hundred. */
export function formatOvers(totalBalls: number, rules: FormatRules): string {
  if (rules.displayInBalls) return String(totalBalls);
  return `${Math.floor(totalBalls / rules.ballsPerOver)}.${totalBalls % rules.ballsPerOver}`;
}

export function normalizeDismissal(type?: string): string {
  return String(type || '').toLowerCase().replace(/[\s\-&]+/g, '_').replace(/_+/g, '_');
}

/** ICC: bowler credited for bowled, caught (incl. c&b), lbw, stumped, hit wicket. */
export function bowlerCreditedDismissal(type?: string): boolean {
  const t = normalizeDismissal(type);
  if (!t || t === 'w' || t === 'wicket') return true; // generic wicket defaults to bowler credit until detailed
  return ['bowled', 'caught', 'caught_and_bowled', 'caught_bowled', 'lbw', 'stumped', 'hit_wicket'].includes(t);
}
