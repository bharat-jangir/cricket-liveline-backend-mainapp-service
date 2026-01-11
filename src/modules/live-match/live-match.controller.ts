import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LiveMatchService } from './live-match.service';
import { UpdateLiveStatusDto } from './dto/update-live-status.dto';
import { UpdateBatsmanDto } from './dto/update-batsman.dto';
import { UpdateBowlerDto } from './dto/update-bowler.dto';
import { UpdateInningDto } from './dto/update-inning.dto';
import { UpdateMatchSquadDto } from './dto/update-match-squad.dto';
import { SwitchTeamDto } from './dto/switch-team.dto';
import { UpdateTossDto } from './dto/update-toss.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

import { ScoreEngineService } from './score-engine/score-engine.service';
import { ScoreEventDto } from './dto/score-event.dto';

@Controller()
export class LiveMatchController {
  private readonly logger = new Logger(LiveMatchController.name);

  constructor(
    private readonly liveMatchService: LiveMatchService,
    private readonly scoreEngineService: ScoreEngineService
  ) { }

  @MessagePattern('live-match.getStatus')
  async getLiveStatus(@Payload() matchId: string) {
    try {
      const result = await this.liveMatchService.getLiveStatus(matchId);
      // Return the service response as-is (contains data.result structure)
      return result;
    } catch (error: any) {
      this.logger.error('Error in getLiveStatus', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateLiveStatus')
  async updateLiveStatus(@Payload() payload: { matchId: string; updateDto: UpdateLiveStatusDto }) {
    try {
      const result = await this.liveMatchService.updateLiveStatus(payload.matchId, payload.updateDto);
      return result;
    } catch (error: any) {
      this.logger.error('Error in updateLiveStatus', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.getSquads')
  async getMatchSquads(@Payload() matchId: string) {
    try {
      const result = await this.liveMatchService.getMatchSquads(matchId);
      return result;
    } catch (error: any) {
      this.logger.error('Error in getMatchSquads', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.getScorecard')
  async getScorecard(@Payload() payload: { matchId: string; inningNumber: number }) {
    try {
      this.logger.log(`getScorecard called with:`, JSON.stringify(payload));
      const result = await this.liveMatchService.getScorecard(payload.matchId, payload.inningNumber);
      return result;
    } catch (error: any) {
      this.logger.error('Error in getScorecard', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateBatsman')
  async updateBatsman(@Payload() payload: { matchId: string; inningNumber: number; playerId: string; updateDto: UpdateBatsmanDto }) {
    try {
      const result = await this.liveMatchService.updateBatsman(payload.matchId, payload.inningNumber, payload.playerId, payload.updateDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateBatsman', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateBowler')
  async updateBowler(@Payload() payload: { matchId: string; inningNumber: number; playerId: string; updateDto: UpdateBowlerDto }) {
    try {
      const result = await this.liveMatchService.updateBowler(payload.matchId, payload.inningNumber, payload.playerId, payload.updateDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateBowler', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateInning')
  async updateInning(@Payload() payload: { matchId: string; inningNumber: number; updateDto: UpdateInningDto }) {
    try {
      const result = await this.liveMatchService.updateInning(payload.matchId, payload.inningNumber, payload.updateDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateInning', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.getOverSummaries')
  async getOverSummaries(@Payload() payload: { matchId: string; inningNumber: number }) {
    try {
      const result = await this.liveMatchService.getOverSummaries(payload.matchId, payload.inningNumber);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in getOverSummaries', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.upsertOverSummary')
  async upsertOverSummary(@Payload() payload: { matchId: string; inningNumber: number; overNumber: number; bowlerId: string; ballsData: any[] }) {
    try {
      const result = await this.liveMatchService.upsertOverSummary(
        payload.matchId,
        payload.inningNumber,
        payload.overNumber,
        payload.bowlerId,
        payload.ballsData,
      );
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in upsertOverSummary', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.initializeScorecards')
  async initializeScorecards(@Payload() payload: { matchId: string; inningNumber: number; teamId: string }) {
    try {
      const result = await this.liveMatchService.initializeScorecardsFromSquad(
        payload.matchId,
        payload.inningNumber,
        payload.teamId,
      );
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in initializeScorecards', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateToss')
  async updateToss(@Payload() payload: { matchId: string; updateTossDto: UpdateTossDto }) {
    try {
      const result = await this.liveMatchService.updateToss(payload.matchId, payload.updateTossDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateToss', error.stack || error.message || error);
      throw error;
    }
  }
  @MessagePattern('live-match.getSessions')
  async getSessions(@Payload() matchId: string) {
    try {
      const result = await this.liveMatchService.getSessions(matchId);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in getSessions', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.addSession')
  async addSession(@Payload() payload: { matchId: string; createDto: CreateSessionDto }) {
    try {
      const result = await this.liveMatchService.addSession(payload.matchId, payload.createDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in addSession', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateSession')
  async updateSession(@Payload() payload: { matchId: string; sessionId: string; updateDto: UpdateSessionDto }) {
    try {
      const result = await this.liveMatchService.updateSession(payload.matchId, payload.sessionId, payload.updateDto);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateSession', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.deleteSession')
  async deleteSession(@Payload() payload: { matchId: string; sessionId: string }) {
    try {
      const result = await this.liveMatchService.deleteSession(payload.matchId, payload.sessionId);
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in deleteSession', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateOverSummary')
  async updateOverSummary(@Payload() payload: { matchId: string; inningNumber: number; overNumber: number; ballsData: any[] }) {
    try {
      const result = await this.liveMatchService.updateOverSummary(
        payload.matchId,
        payload.inningNumber,
        payload.overNumber,
        payload.ballsData,
      );
      if (!result || !result.response) {
        this.logger.error('Service returned invalid result structure', { result });
        throw new Error('Service returned invalid result structure');
      }
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateOverSummary', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.handleEvent')
  async handleEvent(@Payload() payload: { matchId: string; event: ScoreEventDto }) {
    try {
      console.log('handleEvent payload', payload);
      const ballEvent: any = { ...payload.event, matchId: payload.matchId };
      const result = await this.scoreEngineService.handleEvent(payload.matchId, ballEvent);
      // Return wrapped response for gateway
      return {
        status: true,
        statusCode: 200,
        message: 'Event processed successfully',
        data: { result }
      };
    } catch (error: any) {
      this.logger.error('Error in handleEvent', error.stack || error.message || error);
      // Return wrapped error for gateway
      return {
        status: false,
        statusCode: error.status || 500,
        message: error.message || 'Internal Server Error',
        userMessage: error.message || 'Failed to process event',
      };
    }
  }

  @MessagePattern('live-match.handleSimpleEvent')
  async handleSimpleEvent(@Payload() payload: { matchId: string; event: string }) {
    try {
      console.log('handleSimpleEvent payload', payload);

      // Parse simple event string to ScoreEventDto format
      const event = this.parseSimpleEvent(payload.event);
      
      // Use existing score engine with parsed event but preserve original event string
      const ballEvent: any = { ...event, matchId: payload.matchId, originalEvent: payload.event };
      const result = await this.scoreEngineService.handleEvent(payload.matchId, ballEvent);

      return {
        status: true,
        statusCode: 200,
        message: 'Simple event processed successfully',
        data: { result }
      };
    } catch (error: any) {
      this.logger.error('Error in handleSimpleEvent', error.stack || error.message || error);
      return {
        status: false,
        statusCode: error.status || 500,
        message: error.message || 'Internal Server Error',
        userMessage: error.message || 'Failed to process simple event',
      };
    }
  }

  private parseSimpleEvent(eventString: string): any | null {
    const event = eventString.toLowerCase().trim();

    if (/^[1-6]$/.test(event)) {
      return {
        type: 'RUN',
        runs: parseInt(event),
        isBoundary: event === '4' || event === '6'
      };
    }

    if (event === '0') {
      return { type: 'RUN', runs: 0 };
    }

    if (/^lb[1-4]$/.test(event)) {
      return {
        type: 'LEG_BYE',
        runs: parseInt(event.substring(2))
      };
    }

    switch (event) {
      case 'nb': return { type: 'NO_BALL', runs: 0, extras: 1 };
      case 'wd': return { type: 'WIDE', runs: 0, extras: 1 };
      case 'w': return { type: 'WICKET', runs: 0 };
      case 'o': return { type: 'OVER_END' };
      default: 
        // For unknown events, return the event string as type
        return { type: eventString };
    }
  }

  @MessagePattern('live-match.setStriker')
  async setStriker(@Payload() payload: { matchId: string; inningNumber: number; playerId: string }) {
    try {
      const result = await this.liveMatchService.setStriker(payload.matchId, payload.inningNumber, payload.playerId);
      return result;
    } catch (error: any) {
      this.logger.error('Error in setStriker', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.setNonStriker')
  async setNonStriker(@Payload() payload: { matchId: string; inningNumber: number; playerId: string }) {
    try {
      const result = await this.liveMatchService.setNonStriker(payload.matchId, payload.inningNumber, payload.playerId);
      return result;
    } catch (error: any) {
      this.logger.error('Error in setNonStriker', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.swapBatsmen')
  async swapBatsmen(@Payload() payload: { matchId: string; inningNumber: number }) {
    try {
      const result = await this.liveMatchService.swapBatsmen(payload.matchId, payload.inningNumber);
      return result;
    } catch (error: any) {
      this.logger.error('Error in swapBatsmen', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.setCurrentBowler')
  async setCurrentBowler(@Payload() payload: { matchId: string; inningNumber: number; playerId: string }) {
    try {
      const result = await this.liveMatchService.setCurrentBowler(payload.matchId, payload.inningNumber, payload.playerId);
      return result;
    } catch (error: any) {
      this.logger.error('Error in setCurrentBowler', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.getRecentOvers')
  async getRecentOvers(@Payload() payload: { matchId: string; inningNumber?: number }) {
    try {
      const result = await this.liveMatchService.getRecentOvers(payload.matchId, payload.inningNumber);
      return result;
    } catch (error: any) {
      this.logger.error('Error in getRecentOvers', error.stack || error.message || error);
      throw error;
    }
  }

}