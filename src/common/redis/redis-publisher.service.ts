import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

// ─────────────────────────────────────────────────────────────────────────────
// Shared payload types (imported by both main-app and socket-service)
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamMeta {
  teamId: string;
  name: string;
  code: string;
  score: string;   // "145/3"
  overs: string;   // "18.4"
}

export interface MatchUpdatePayload {
  matchId: string;
  type: 'BALL' | 'WICKET' | 'OVER_END' | 'MATCH_RESET';
  timestamp: Date;

  // Root-level generalized fields
  score?: string;
  overs?: string | number;
  runRate?: number;
  currentBall?: string;
  currentInning?: number;
  
  currentStrikerId?: string;
  currentNonStrikerId?: string;
  currentBowlerId?: string;

  inning: {
    number: number;
    totalRuns: number;
    totalBalls: number;
    wickets: number;
    overs: number | string;      // decimal e.g. 18.4
    runRate: number;
    extras: number;
  };

  // Current players (Legacy structure for backward compatibility)
  striker?: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
  };
  nonStriker?: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
  };
  bowler?: {
    playerId: string;
    name: string;
    overs: number;
    runs: number;
    wickets: number;
    economy: number;
  };

  // Last delivery info
  lastBall?: {
    runs: number;
    extras: number;
    isWicket: boolean;
    ballType: string;
    ballLabel: string;  
  };

  // Team score summaries
  teamA: TeamMeta;
  teamB: TeamMeta;

  // 2nd-inning chase context
  target?: number;
  requiredRunRate?: number;
  requiredRuns?: number;
  remainingBalls?: number;
  recentBalls?: any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Listing-level lightweight payload
// ─────────────────────────────────────────────────────────────────────────────

export interface ListingUpdatePayload {
  matchId: string;
  teamA: TeamMeta;
  teamB: TeamMeta;
  status: string;
  currentInning: number;
  runRate: number;
  requiredRunRate?: number;
  lastBallLabel: string;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scorecard delta — sent per ball so match-room clients can update detail tab
// ─────────────────────────────────────────────────────────────────────────────

export interface BatterDelta {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalText?: string;
  isOnStrike: boolean;
}

export interface BowlerDelta {
  playerId: string;
  name: string;
  overs: number;
  runs: number;
  wickets: number;
  economy: number;
  isCurrent: boolean;
}

export interface ScorecardDeltaPayload {
  matchId: string;
  inningNumber: number;
  batting: BatterDelta[];
  bowling: BowlerDelta[];
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalties: number;
    total: number;
  };
  totalRuns: number;
  wickets: number;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialized Payloads for granular updates
// ─────────────────────────────────────────────────────────────────────────────

export interface InningChangePayload {
  matchId: string;
  inningNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  timestamp: Date;
}

export interface OddsSessionPayload {
  matchId: string;
  oddsTeam?: string;
  oddsBlue?: number | string;
  oddsRed?: number | string;
  session?: number | string;
  sessionBlue?: number | string;
  sessionRed?: number | string;
  lambi?: number | string;
  lambiBlue?: number | string;
  lambiRed?: number | string;
  timestamp: Date;
}

export interface PowerplayUpdatePayload {
  matchId: string;
  powerplayOvers?: string;
  onOC?: boolean;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commentary payload — one entry per ball delivery
// ─────────────────────────────────────────────────────────────────────────────

export interface CommentaryPayload {
  matchId: string;
  inningNumber: number;
  overNumber: number;
  ballLabel: string;
  ballType: string;
  commentary: string;
  runs: number;
  extras: number;
  isWicket: boolean;
  batsmanName: string;
  batsmanId?: string;
  bowlerName: string;
  bowlerId?: string;
  highlightData?: any;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis publisher service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RedisPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
      socket: {
        connectTimeout: 5000,
      },
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    this.client.connect().catch((err) => {
      this.logger.error('Failed to connect to Redis:', err);
    });
  }

  /** Publish full match update to the per-match channel */
  async publishMatchUpdate(payload: MatchUpdatePayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:ball`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published to ${channel}: ${payload.type}`);
    } catch (error) {
      this.logger.error('Failed to publish match update:', error);
    }
  }

  /** Publish lightweight listing card update (global broadcast channel) */
  async publishListingUpdate(payload: ListingUpdatePayload): Promise<void> {
    try {
      const channel = 'live-match:listing';
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published listing update for match ${payload.matchId}`);
    } catch (error) {
      this.logger.error('Failed to publish listing update:', error);
    }
  }

  /** Publish scorecard delta for the per-match detail channel */
  async publishScorecardDelta(payload: ScorecardDeltaPayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:scorecard`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published scorecard delta for match ${payload.matchId}`);
    } catch (error) {
      this.logger.error('Failed to publish scorecard delta:', error);
    }
  }

  /** Publish a single-ball commentary entry */
  async publishCommentary(payload: CommentaryPayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:commentary`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published commentary for match ${payload.matchId}`);
    } catch (error) {
      this.logger.error('Failed to publish commentary:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Specialized Publishers
  // ─────────────────────────────────────────────────────────────────────────────

  async publishInningChange(payload: InningChangePayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:inning`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.log(`Published inning change for match ${payload.matchId} to Inning ${payload.inningNumber}`);
    } catch (error) {
      this.logger.error('Failed to publish inning change:', error);
    }
  }

  async publishOddsSession(payload: OddsSessionPayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:odds`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published odds/session update for match ${payload.matchId}`);
    } catch (error) {
      this.logger.error('Failed to publish odds/session update:', error);
    }
  }

  async publishPowerplayUpdate(payload: PowerplayUpdatePayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:powerplay`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published powerplay update for match ${payload.matchId}`);
    } catch (error) {
      this.logger.error('Failed to publish powerplay update:', error);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}