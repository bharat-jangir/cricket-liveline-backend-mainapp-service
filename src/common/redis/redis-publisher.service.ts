import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

export interface MatchUpdatePayload {
  matchId: string;
  type: 'BALL' | 'WICKET' | 'OVER_END' | 'MATCH_RESET';
  timestamp: Date;
  inning: {
    number: number;
    totalRuns: number;
    totalBalls: number;
    wickets: number;
    overs: number;
    runRate: number;
  };
  striker?: {
    playerId: string;
    runs: number;
    balls: number;
    strikeRate: number;
  };
  bowler?: {
    playerId: string;
    overs: number;
    runs: number;
    wickets: number;
    economy: number;
  };
  lastBall?: {
    runs: number;
    extras: number;
    isWicket: boolean;
    ballType: string;
  };
}

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

  async publishMatchUpdate(payload: MatchUpdatePayload): Promise<void> {
    try {
      const channel = `match:${payload.matchId}:ball`;
      await this.client.publish(channel, JSON.stringify(payload));
      this.logger.debug(`Published to ${channel}: ${payload.type}`);
    } catch (error) {
      this.logger.error('Failed to publish match update:', error);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}