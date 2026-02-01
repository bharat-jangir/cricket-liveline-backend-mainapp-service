import { Controller, Logger, Patch, Param, Body, Get } from '@nestjs/common';
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

@Controller('live-match')
export class LiveMatchController {
  private readonly logger = new Logger(LiveMatchController.name);

  constructor(
    private readonly liveMatchService: LiveMatchService,
    private readonly scoreEngineService: ScoreEngineService
  ) { }

  @Patch(':matchId/match-details')
  @MessagePattern('live-match.updateMatchDetails')
  async updateMatchDetails(@Param('matchId') matchId: string, @Payload() payload: any) {
    try {
      // Handle both HTTP and MessagePattern payloads
      const mid = matchId || payload.matchId;
      const dto = payload.updateDto || payload;

      const result = await this.liveMatchService.updateMatchDetails(mid, dto);
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in updateMatchDetails', error.stack || error.message || error);
      throw error;
    }
  }

  @Get(':matchId/match-details')
  @MessagePattern('live-match.getMatchDetails')
  async getMatchDetails(@Param('matchId') matchId: string, @Payload() payload: any) {
    try {
      const mid = matchId || payload;
      const result = await this.liveMatchService.getMatchDetails(mid);
      return result.response;
    } catch (error: any) {
      this.logger.error('Error in getMatchDetails', error.stack || error.message || error);
      throw error;
    }
  }

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
  async handleSimpleEvent(@Payload() payload: { matchId: string; event: string; bowlerName?: string; batsmanName?: string }) {
    try {
      console.log('handleSimpleEvent payload', payload);

      // Parse simple event string to ScoreEventDto format
      const event = this.parseSimpleEvent(payload.event);

      // Use existing score engine with parsed event but preserve original event string
      const ballEvent: any = {
        ...event,
        matchId: payload.matchId,
        originalEvent: payload.event,
        bowlerName: payload.bowlerName,
        batsmanName: payload.batsmanName
      };
      const result = await this.scoreEngineService.handleEvent(payload.matchId, ballEvent);

      // Check if wicket selection is required
      if (result && result.requiresWicketSelection) {
        return {
          status: true,
          statusCode: 200,
          message: 'Wide/No-ball processed, wicket selection required',
          data: {
            result,
            requiresWicketSelection: true,
            wicketContext: result.wicketContext
          }
        };
      }

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

    // Regular runs (0-6)
    if (/^[0-6]$/.test(event)) {
      return {
        type: 'RUN',
        runs: parseInt(event),
        isBoundary: event === '4' || event === '6'
      };
    }

    // Leg byes: lb1, lb2, lb3, lb4, lb5, lb6
    if (/^lb[0-6]$/.test(event)) {
      return {
        type: 'LEG_BYE',
        runs: parseInt(event.substring(2))
      };
    }

    // Byes: 1b, 2b...
    if (/^[0-6]b$/.test(event)) {
      return {
        type: 'BYE',
        runs: parseInt(event.charAt(0))
      };
    }

    // Leg Byes: 1lb, 2lb...
    if (/^[0-6]lb$/.test(event)) {
      return {
        type: 'LEG_BYE',
        runs: parseInt(event.charAt(0))
      };
    }

    // Penalty: p1-p9
    if (/^p[1-9]$/.test(event)) {
      return {
        type: 'PENALTY',
        runs: 0,
        extras: parseInt(event.substring(1))
      };
    }

    // Wide + runs/extras: wd0-6, wd1b-6b, wd1lb-6lb
    if (/^wd([0-6])(b|lb)?$/.test(event)) {
      const match = event.match(/^wd([0-6])(b|lb)?$/);
      if (match) {
        const runsTaken = parseInt(match[1]);
        const extraType = match[2];
        const type = extraType === 'b' ? 'BYE' : extraType === 'lb' ? 'LEG_BYE' : null;
        return {
          type: 'WIDE',
          runs: 0, // In Wide deliveries, all runs are extras (Wides)
          extras: 1 + runsTaken,
          isBoundary: runsTaken === 4 || runsTaken === 6,
          isExtraType: type as any
        };
      }
    }

    // No-ball + byes/leg-byes: nb1b, nb1lb etc.
    if (/^nb[0-6](b|lb)$/.test(event)) {
      const match = event.match(/^nb([0-6])(b|lb)$/);
      if (match) {
        const runsTaken = parseInt(match[1]);
        const type = match[2] === 'b' ? 'BYE' : 'LEG_BYE';
        return {
          type: 'NO_BALL',
          runs: 0, // All runs go to No Ball extras if it's a bye/leg-bye
          extras: 1 + runsTaken,
          isExtraType: type // Flag to help engine categorize it as NB extra but track it was a bye
        };
      }
    }

    // No-ball + runs: nb0, nb1, nb2, nb3, nb4, nb5, nb6
    if (/^nb[0-6]$/.test(event)) {
      const runsTaken = parseInt(event.substring(2));
      return {
        type: 'NO_BALL',
        runs: runsTaken, // Hits go to batter
        extras: 1,
        isBoundary: runsTaken === 4 || runsTaken === 6
      };
    }

    // Wide + wicket: wdw (requires dismissal type selection)
    if (event === 'wdw') {
      return {
        type: 'WIDE',
        runs: 0,
        extras: 1,
        triggerWicket: true
      };
    }

    // No-ball + wicket: nbw (requires dismissal type selection)
    if (event === 'nbw') {
      return {
        type: 'NO_BALL',
        runs: 0,
        extras: 1,
        triggerWicket: true
      };
    }

    // Simple events
    switch (event) {
      case 'nb': return { type: 'NO_BALL', runs: 0, extras: 1 };
      case 'wd': return { type: 'WIDE', runs: 0, extras: 1 };
      case 'w': return { type: 'WICKET', runs: 0 };
      case 'o': return { type: 'OVER_END' };
      case 'u': return { type: 'UNDO' };
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

  @MessagePattern('live-match.updateSquad')
  async updateMatchSquad(@Payload() payload: { matchId: string; teamId: string; updateDto: UpdateMatchSquadDto }) {
    try {
      const result = await this.liveMatchService.updateMatchSquad(payload.matchId, payload.teamId, payload.updateDto);
      return result;
    } catch (error: any) {
      this.logger.error('Error in updateMatchSquad', error.stack || error.message || error);
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

  @MessagePattern('live-match.getCommentary')
  async getCommentary(@Payload() payload: { matchId: string; inningId?: string }) {
    try {
      const result = await this.liveMatchService.getMatchCommentary(payload.matchId, payload.inningId);
      return result;
    } catch (error: any) {
      this.logger.error('Error in getCommentary', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.updateCommentary')
  async updateCommentary(@Payload() payload: { commentaryId: string; commentary: string }) {
    try {
      const result = await this.liveMatchService.updateCommentary(payload.commentaryId, payload.commentary);
      return result;
    } catch (error: any) {
      this.logger.error('Error in updateCommentary', error.stack || error.message || error);
      throw error;
    }
  }

  @MessagePattern('live-match.deleteCommentary')
  async deleteCommentary(@Payload() payload: { commentaryId: string }) {
    try {
      const result = await this.liveMatchService.deleteCommentary(payload.commentaryId);
      return result;
    } catch (error: any) {
      this.logger.error('Error in deleteCommentary', error.stack || error.message || error);
      throw error;
    }
  }

}