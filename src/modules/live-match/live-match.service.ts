import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import { Match } from '../../entities/match.entity';
import { Inning } from '../../entities/inning.entity';
import { BattingScorecard } from '../../entities/batting-scorecard.entity';
import { BowlingScorecard } from '../../entities/bowling-scorecard.entity';
import { MatchSquad } from '../../entities/match-squad.entity';
import { OverSummary } from '../../entities/over-summary.entity';
import { UpdateLiveStatusDto } from './dto/update-live-status.dto';
import { UpdateBatsmanDto } from './dto/update-batsman.dto';
import { UpdateBowlerDto } from './dto/update-bowler.dto';
import { UpdateInningDto } from './dto/update-inning.dto';
import { UpdateMatchSquadDto } from './dto/update-match-squad.dto';
import { SwitchTeamDto } from './dto/switch-team.dto';
import { UpdateTossDto } from './dto/update-toss.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { LiveMatchSession } from '../../entities/live-match-session.entity';
import { Partnership } from '../../entities/partnership.entity';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class LiveMatchService {
  private readonly logger = new Logger(LiveMatchService.name);

  constructor(
    @InjectModel(Match.name) private matchModel: Model<Match>,
    @InjectModel(Inning.name) private inningModel: Model<Inning>,
    @InjectModel(BattingScorecard.name) private battingScorecardModel: Model<BattingScorecard>,
    @InjectModel(BowlingScorecard.name) private bowlingScorecardModel: Model<BowlingScorecard>,
    @InjectModel(MatchSquad.name) private matchSquadModel: Model<MatchSquad>,
    @InjectModel(OverSummary.name) private overSummaryModel: Model<OverSummary>,
    @InjectModel(LiveMatchSession.name) private liveMatchSessionModel: Model<LiveMatchSession>,
    @InjectModel(Partnership.name) private partnershipModel: Model<Partnership>,
    @InjectConnection() private readonly connection: Connection,
    private readonly responseService: ResponseService,
  ) { }

  /**
   * Helper method to run an operation within a MongoDB transaction.
   * Handles session start, commit/abort, and retry logic.
   */
  private async runInTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // Helper method to validate inning number based on match format
  private async validateInningNumber(matchId: string, inningNumber: number): Promise<{ valid: boolean; error?: any }> {
    if (!Types.ObjectId.isValid(matchId)) {
      return {
        valid: false,
        error: this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        ),
      };
    }

    const matchObjectId = new Types.ObjectId(matchId);
    const match = await this.matchModel.findById(matchObjectId).lean();

    if (!match) {
      return {
        valid: false,
        error: this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          'Match with the provided ID does not exist',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        ),
      };
    }

    // Test matches can have 4 innings, ODI/T20 can only have 2
    // Exception: Super Overs (which might be inning 3/4 for T20/ODI)
    // We check if the match result type implies a tie/super over scenario OR if totalInnings is > 2 (configured for super over)
    const isSuperOver = match.result?.resultType === 'super_over' || match.result?.resultType === 'tie' || match.totalInnings > 2;

    if (match.matchFormat !== 'test' && inningNumber > 2 && !isSuperOver) {
      return {
        valid: false,
        error: this.responseService.error(
          'Invalid inning number for match format',
          'INVALID_INNING_NUMBER',
          `${match.matchFormat.toUpperCase()} matches can only have 2 innings. Innings 3 and 4 are only allowed for test matches or Super Overs.`,
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        ),
      };
    }

    return { valid: true };
  }

  // Update match details (toss, umpires, pitch conditions)
  async updateMatchDetails(matchId: string, updateDto: any): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);

      // Convert umpire IDs to ObjectIds if provided
      const updateData: any = {};

      if (updateDto.toss) {
        updateData.toss = updateDto.toss;
      }

      if (updateDto.officials) {
        updateData.officials = {};
        if (updateDto.officials.umpire1Id && Types.ObjectId.isValid(updateDto.officials.umpire1Id)) {
          updateData.officials.umpire1Id = new Types.ObjectId(updateDto.officials.umpire1Id);
        }
        if (updateDto.officials.umpire2Id && Types.ObjectId.isValid(updateDto.officials.umpire2Id)) {
          updateData.officials.umpire2Id = new Types.ObjectId(updateDto.officials.umpire2Id);
        }
        if (updateDto.officials.thirdUmpireId && Types.ObjectId.isValid(updateDto.officials.thirdUmpireId)) {
          updateData.officials.thirdUmpireId = new Types.ObjectId(updateDto.officials.thirdUmpireId);
        }
        if (updateDto.officials.refereeId && Types.ObjectId.isValid(updateDto.officials.refereeId)) {
          updateData.officials.refereeId = new Types.ObjectId(updateDto.officials.refereeId);
        }
      }

      if (updateDto.conditions) {
        updateData.conditions = updateDto.conditions;
      }

      if (updateDto.headToHead) {
        updateData.headToHead = updateDto.headToHead;
      }

      if (updateDto.teamForm) {
        updateData.teamForm = updateDto.teamForm;
      }

      if (updateDto.venueId && Types.ObjectId.isValid(updateDto.venueId)) {
        updateData.venueId = new Types.ObjectId(updateDto.venueId);
      }

      if (updateDto.ballsPerOver !== undefined) updateData.ballsPerOver = updateDto.ballsPerOver;
      if (updateDto.oversPerInning !== undefined) updateData.oversPerInning = updateDto.oversPerInning;
      if (updateDto.maxBowlerLimit !== undefined) updateData.maxBowlerLimit = updateDto.maxBowlerLimit;
      if (updateDto.matchFormat) updateData.matchFormat = updateDto.matchFormat.toLowerCase();

      // Update the match directly
      const match = await this.matchModel.findByIdAndUpdate(
        matchObjectId,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate('officials.umpire1Id', 'name')
        .populate('officials.umpire2Id', 'name')
        .populate('officials.thirdUmpireId', 'name')
        .populate('officials.refereeId', 'name')
        .populate('venueId', 'name city country')
        .lean();

      if (!match) {
        return this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          'Match not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        match, // Return match as it now contains details
        'Match details updated successfully',
        'MATCH_DETAILS_UPDATED',
        'Match details updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update match details',
        'MATCH_DETAILS_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get match details
  async getMatchDetails(matchId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const match = await this.matchModel
        .findById(matchId)
        .populate('officials.umpire1Id', 'name')
        .populate('officials.umpire2Id', 'name')
        .populate('officials.thirdUmpireId', 'name')
        .populate('officials.refereeId', 'name')
        .populate('toss.winnerId', 'name shortName')
        .populate('venueId', 'name city country')
        .lean();

      return this.responseService.successWithSingle(
        match || {},
        'Match details retrieved successfully',
        'MATCH_DETAILS_RETRIEVED',
        'Match details retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch match details',
        'MATCH_DETAILS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get live match status
  async getLiveStatus(matchId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);

      const match = await this.matchModel
        .findById(matchObjectId)
        .populate('toss.winnerId', 'name shortName code logo')
        .lean();

      if (!match) {
        return this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          'Match not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      const currentInning = await this.inningModel.findOne({
        matchId: matchObjectId,
        inningNumber: match.currentInning
      })
        .populate('battingTeamId', 'name shortName code logo')
        .populate('bowlingTeamId', 'name shortName code logo')
        .lean();

      const innings = await this.inningModel.find({ matchId: matchObjectId })
        .populate('battingTeamId', 'name shortName code logo')
        .populate('bowlingTeamId', 'name shortName code logo')
        .sort({ inningNumber: 1 })
        .lean();

      // Construct return object mimicking old LiveMatchStatus structure
      const liveStatus: any = {
        matchId: match._id,
        currentInning: match.currentInning,
        toss: match?.toss,
        innings: innings, // Include all innings

        // Match level status flags
        isMatchNew: match.isMatchNew,
        viewMode: match.viewMode,
        isNotShowing: match.isNotShowing,
        noCommentry: match.noCommentry,
        onOC: match.onOC,
        comment2: match.comment2,
        matchStatus: match.status,
        matchState: match.matchState,

        // Odds / Session from Match
        oddsTeam: match.oddsTeam,
        oddsBlue: match.oddsBlue,
        oddsRed: match.oddsRed,
        session: match.session,
        sessionBlue: match.sessionBlue,
        sessionRed: match.sessionRed,
        lambi: match.lambi,
        lambiBlue: match.lambiBlue,
        lambiRed: match.lambiRed,

        // Config
        ballsPerOver: match.ballsPerOver,
        oversPerInning: match.oversPerInning,
      };

      if (currentInning) {
        // Inning level data
        liveStatus.battingTeamId = currentInning.battingTeamId;
        liveStatus.bowlingTeamId = currentInning.bowlingTeamId;

        // State
        const ballsPerOver = match.ballsPerOver || 6;
        const currentOver = Math.floor(currentInning.totalBalls / ballsPerOver);
        const currentBall = currentInning.totalBalls % ballsPerOver;

        liveStatus.score = `${currentInning.totalRuns}/${currentInning.totalWickets}`;
        liveStatus.overs = `${currentOver}.${currentBall}`;
        liveStatus.balls = currentInning.totalBalls;
        liveStatus.currentOver = currentOver;
        liveStatus.currentBall = currentInning.currentBall; // String value (e.g., 'check')

        // Players
        liveStatus.currentStrikerId = currentInning.currentStrikerId;
        liveStatus.currentNonStrikerId = currentInning.currentNonStrikerId;
        liveStatus.currentBowlerId = currentInning.currentBowlerId;

        liveStatus.lastWicket = currentInning.lastWicket;

        // Calculated Run Rate
        if (currentInning.totalBalls > 0) {
          liveStatus.runRate = (currentInning.totalRuns / currentInning.totalBalls) * ballsPerOver;
        } else {
          liveStatus.runRate = 0;
        }

        // Calculate Equation for Chasing Team
        if (match.currentInning > 1) {
          let target = currentInning.target;

          // If target not set on inning, try to calculate from previous inning (Limited Overs only)
          if (!target && match.matchFormat !== 'test') {
            const firstInning = innings.find(inn => inn.inningNumber === 1);
            if (firstInning) {
              target = firstInning.totalRuns + 1;
            }
          }

          if (target) {
            const currentRuns = currentInning.totalRuns;
            const runsNeeded = Math.max(0, target - currentRuns);

            const ballsPerOver = match.ballsPerOver || 6;
            // Use large number for tests if not defined
            const maxOvers = match.oversPerInning || (match.matchFormat === 'test' ? 9999 : 20);
            const maxBalls = maxOvers * ballsPerOver;
            const ballsRem = Math.max(0, maxBalls - currentInning.totalBalls);

            liveStatus.equation = {
              target,
              runsNeeded,
              ballsRemaining: ballsRem,
              requiredRunRate: ballsRem > 0 ? (runsNeeded / ballsRem) * ballsPerOver : 0
            };
          }
        }
      }

      return this.responseService.successWithSingle(
        liveStatus,
        'Live status retrieved successfully',
        'LIVE_STATUS_RETRIEVED',
        'Live status retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch live status',
        'LIVE_STATUS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get all innings for a match
  async getAllInnings(matchId: string): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);
      console.log(`[getAllInnings] Fetching innings for matchId: ${matchId} (ObjectId: ${matchObjectId})`);

      const innings = await this.inningModel.find({ matchId: matchObjectId })
        .populate('battingTeamId', 'name shortName code logo')
        .populate('bowlingTeamId', 'name shortName code logo')
        .sort({ inningNumber: 1 })
        .lean();

      console.log(`[getAllInnings] Found ${innings.length} innings for match ${matchId}`);
      if (innings.length === 0) {
        // Double check count without population just in case
        const count = await this.inningModel.countDocuments({ matchId: matchObjectId });
        console.log(`[getAllInnings] Raw count check: ${count}`);
      }

      return this.responseService.successWithSingle(
        innings,
        'Innings retrieved successfully',
        'INNINGS_RETRIEVED',
        'Innings retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch innings',
        'INNINGS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get batch live scores for multiple matches
  async getBatchLiveScores(matchIds: string[]): Promise<Record<string, any>> {
    try {
      const matchObjectIds = matchIds
        .filter(id => Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));

      if (matchObjectIds.length === 0) return {};

      // Fetch all innings for these matches
      const innings = await this.inningModel.find({ matchId: { $in: matchObjectIds } }).lean();

      // Group innings by match ID
      const scoresByMatch: Record<string, any> = {};

      // Initialize with empty for all requested IDs in case some have no innings
      matchIds.forEach(id => {
        scoresByMatch[id] = null;
      });

      matchIds.forEach(matchId => {
        // Filter innings for this match
        const matchInnings = innings.filter(inn => String(inn.matchId) === String(matchId));

        if (matchInnings.length > 0) {
          // Sort innings
          matchInnings.sort((a, b) => a.inningNumber - b.inningNumber);

          const latestInning = matchInnings[matchInnings.length - 1];
          const score = `${latestInning.totalRuns}/${latestInning.totalWickets}`;

          // Simple overs calculation (assuming 6 balls per over if not available)
          const currentOver = Math.floor(latestInning.totalBalls / 6);
          const currentBall = latestInning.totalBalls % 6;
          const overs = `${currentOver}.${currentBall}`;

          scoresByMatch[matchId] = {
            score,
            overs,
            innings: matchInnings.map(inn => ({
              inningNumber: inn.inningNumber,
              totalRuns: inn.totalRuns,
              totalWickets: inn.totalWickets,
              totalBalls: inn.totalBalls,
              battingTeamId: inn.battingTeamId,
              bowlingTeamId: inn.bowlingTeamId,
              type: inn.type || 'normal',
              superOverNumber: inn.superOverNumber,
              isAllOut: inn.isAllOut
            }))
          };
        }
      });

      return scoresByMatch;
    } catch (error) {
      this.logger.error(`Error fetching batch live scores: ${error.message}`);
      return {};
    }
  }

  // Get recent overs for admin panel (last 3 overs)
  async getRecentOvers(matchId: string, inningNumber?: number): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);

      // Get current inning if not specified
      let targetInning = inningNumber;
      if (!targetInning) {
        const match = await this.matchModel.findById(matchObjectId).select('currentInning').lean();
        targetInning = match?.currentInning || 1;
      }

      const inning = await this.inningModel.findOne({
        matchId: matchObjectId,
        inningNumber: targetInning
      }).lean();

      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          'Inning not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      const currentOverNumber = Math.floor(inning.totalBalls / 6) + (inning.totalBalls % 6 > 0 ? 1 : 0);
      const startOver = Math.max(1, currentOverNumber - 2); // Last 3 overs

      const recentOvers = await this.overSummaryModel
        .find({
          matchId: matchObjectId,
          inningId: inning._id,
          overNumber: { $gte: startOver, $lte: currentOverNumber }
        })
        .populate('bowlerId', 'name')
        .sort({ overNumber: 1 })
        .lean();

      return this.responseService.successWithSingle(
        {
          inningNumber: targetInning,
          currentOver: currentOverNumber,
          overs: recentOvers
        },
        'Recent overs retrieved successfully',
        'RECENT_OVERS_RETRIEVED',
        'Recent overs retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch recent overs',
        'RECENT_OVERS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get partnerships
  async getPartnerships(matchId: string, inningNumber?: number): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error('Invalid match ID', 'INVALID_MATCH_ID', 'Match ID must be a valid MongoDB ObjectId', undefined, null, HttpStatus.BAD_REQUEST);
      }

      const matchObjectId = new Types.ObjectId(matchId);

      let targetInning = inningNumber;
      if (!targetInning) {
        const match = await this.matchModel.findById(matchObjectId).select('currentInning').lean();
        targetInning = match?.currentInning || 1;
      }

      const inning = await this.inningModel.findOne({
        matchId: matchObjectId,
        inningNumber: targetInning
      }).lean();

      if (!inning) {
        return this.responseService.error('Inning not found', 'INNING_NOT_FOUND', 'Inning not found', undefined, null, HttpStatus.NOT_FOUND);
      }

      const partnerships = await this.partnershipModel.find({
        matchId: matchObjectId,
        inningId: inning._id
      }).populate('batsman1Id', 'name shortName playerKey').populate('batsman2Id', 'name shortName playerKey').sort({ wicketNumber: 1 }).lean();

      return this.responseService.successWithSingle(
        partnerships,
        'Partnerships retrieved successfully',
        'PARTNERSHIPS_RETRIEVED',
        'Partnerships retrieved successfully',
        undefined,
        HttpStatus.OK
      );
    } catch (error) {
      this.logger.error(`getPartnerships error:`, error);
      return this.responseService.error('Failed to fetch partnerships', 'PARTNERSHIPS_FETCH_FAILED', error.message, undefined, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Upsert Partnerships
  async upsertPartnerships(matchId: string, inningNumber: number, partnerships: any[]): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error('Invalid match ID', 'INVALID_MATCH_ID', 'Match ID must be a valid MongoDB ObjectId', undefined, null, HttpStatus.BAD_REQUEST);
      }

      const execute = async (s: ClientSession) => {
        const matchObjectId = new Types.ObjectId(matchId);

        let targetInning = inningNumber;
        if (!targetInning) {
          const match = await this.matchModel.findById(matchObjectId).select('currentInning').session(s).lean();
          targetInning = match?.currentInning || 1;
        }

        const inning = await this.inningModel.findOne({
          matchId: matchObjectId,
          inningNumber: targetInning
        }).session(s).lean();

        if (!inning) {
          return this.responseService.error('Inning not found', 'INNING_NOT_FOUND', 'Inning not found', undefined, null, HttpStatus.NOT_FOUND);
        }

        // Delete existing and insert new ones
        await this.partnershipModel.deleteMany({
          matchId: matchObjectId,
          inningId: inning._id
        }).session(s);

        const newPartnerships = partnerships.map(p => ({
          ...p,
          matchId: matchObjectId,
          inningId: inning._id
        }));

        if (newPartnerships.length > 0) {
          await this.partnershipModel.insertMany(newPartnerships, { session: s });
        }

        return this.responseService.successWithSingle(
          null,
          'Partnerships updated successfully',
          'PARTNERSHIPS_UPDATED',
          'Partnerships updated successfully',
          undefined,
          HttpStatus.OK
        );
      };

      return await this.runInTransaction(execute);
    } catch (error) {
      this.logger.error(`upsertPartnerships error:`, error);
      return this.responseService.error('Failed to update partnerships', 'PARTNERSHIPS_UPDATE_FAILED', error.message, undefined, null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Update live match status
  async updateLiveStatus(matchId: string, updateDto: UpdateLiveStatusDto, session?: ClientSession): Promise<IResponseWithStatusCode<any>> {
    try {
      this.logger.log(`updateLiveStatus called with matchId: ${matchId}, updateDto:`, JSON.stringify(updateDto));

      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const execute = async (s: ClientSession) => {
        const matchObjectId = new Types.ObjectId(matchId);

        // Check if match exists
        const match = await this.matchModel.findById(matchObjectId).session(s);
        if (!match) {
          return this.responseService.error(
            'Match not found',
            'MATCH_NOT_FOUND',
            `Match with ID ${matchId} not found`,
            undefined,
            null,
            HttpStatus.NOT_FOUND,
          );
        }

        // 1. Handle Inning Transition / Creation
        let currentInningNum = match.currentInning;
        if (updateDto.currentInning !== undefined && updateDto.currentInning !== match.currentInning) {
          // Update match current inning
          match.currentInning = updateDto.currentInning;
          await match.save({ session: s });
          currentInningNum = updateDto.currentInning;

          // Ensure target inning exists
          const existingTargetInning = await this.inningModel.findOne({
            matchId: matchObjectId,
            inningNumber: currentInningNum
          }).session(s);

          if (!existingTargetInning) {
            // Create new inning if it doesn't exist
            // Infer teams: swap from previous inning if possible
            let battingTeamId, bowlingTeamId;

            // If teams are provided in DTO, use them
            if (updateDto.battingTeamId) battingTeamId = new Types.ObjectId(updateDto.battingTeamId);
            if (updateDto.bowlingTeamId) bowlingTeamId = new Types.ObjectId(updateDto.bowlingTeamId);

            if (!battingTeamId || !bowlingTeamId) {
              // Try to fetch previous inning to swap
              const prevInning = await this.inningModel.findOne({
                matchId: matchObjectId,
                inningNumber: currentInningNum - 1
              }).session(s);

              if (prevInning) {
                if (!battingTeamId) battingTeamId = prevInning.bowlingTeamId;
                if (!bowlingTeamId) bowlingTeamId = prevInning.battingTeamId;
              } else {
                // Fallback to match teams (Team A bats first default?)
                // This is a crude fallback, ideally should be explicit
                if (!battingTeamId) battingTeamId = match.teamAId as any;
                if (!bowlingTeamId) bowlingTeamId = match.teamBId as any;
              }
            }

            await this.inningModel.create([{
              matchId: matchObjectId,
              inningNumber: currentInningNum,
              battingTeamId,
              bowlingTeamId,
              totalRuns: 0,
              totalWickets: 0,
              totalBalls: 0,
              totalOvers: 0
            }], { session: s });
          }
        }

        // 2. Prepare Updates
        const inningUpdate: any = {};
        const matchUpdate: any = {};

        // Match Level Updates
        if (updateDto.ballsPerOver !== undefined) matchUpdate.ballsPerOver = updateDto.ballsPerOver;
        if (updateDto.oversPerInning !== undefined) matchUpdate.oversPerInning = updateDto.oversPerInning;

        // Odds / Session / Lambi
        if (updateDto.oddsTeam !== undefined) matchUpdate.oddsTeam = updateDto.oddsTeam;
        if (updateDto.oddsBlue !== undefined) matchUpdate.oddsBlue = updateDto.oddsBlue;
        if (updateDto.oddsRed !== undefined) matchUpdate.oddsRed = updateDto.oddsRed;
        if (updateDto.session !== undefined) matchUpdate.session = updateDto.session;
        if (updateDto.sessionBlue !== undefined) matchUpdate.sessionBlue = updateDto.sessionBlue;
        if (updateDto.sessionRed !== undefined) matchUpdate.sessionRed = updateDto.sessionRed;
        if (updateDto.lambi !== undefined) matchUpdate.lambi = updateDto.lambi;
        if (updateDto.lambiBlue !== undefined) matchUpdate.lambiBlue = updateDto.lambiBlue;
        if (updateDto.lambiRed !== undefined) matchUpdate.lambiRed = updateDto.lambiRed;

        // Flags
        if (updateDto.isMatchNew !== undefined) matchUpdate.isMatchNew = updateDto.isMatchNew;
        if (updateDto.viewMode !== undefined) matchUpdate.viewMode = updateDto.viewMode;
        if (updateDto.isNotShowing !== undefined) matchUpdate.isNotShowing = updateDto.isNotShowing;
        if (updateDto.noCommentry !== undefined) matchUpdate.noCommentry = updateDto.noCommentry;
        if (updateDto.onOC !== undefined) matchUpdate.onOC = updateDto.onOC;
        if (updateDto.comment2 !== undefined) matchUpdate.comment2 = updateDto.comment2;
        if (updateDto.matchStatus !== undefined) matchUpdate.status = updateDto.matchStatus;
        if (updateDto.matchState !== undefined) matchUpdate.matchState = updateDto.matchState;


        // Inning Level Updates
        if (updateDto.battingTeamId && Types.ObjectId.isValid(updateDto.battingTeamId)) {
          inningUpdate.battingTeamId = new Types.ObjectId(updateDto.battingTeamId);
        }
        if (updateDto.bowlingTeamId && Types.ObjectId.isValid(updateDto.bowlingTeamId)) {
          inningUpdate.bowlingTeamId = new Types.ObjectId(updateDto.bowlingTeamId);
        }

        // Manual Score Updates
        if (updateDto.score) {
          const [runs, wickets] = updateDto.score.split('/').map(n => parseInt(n, 10));
          if (!isNaN(runs)) inningUpdate.totalRuns = runs;
          if (!isNaN(wickets)) inningUpdate.totalWickets = wickets;
        }

        if (updateDto.overs) {
          const [overPart, ballPart] = updateDto.overs.split('.').map(n => parseInt(n, 10));
          if (!isNaN(overPart)) {
            const totalBalls = (overPart * 6) + (ballPart || 0);
            inningUpdate.totalBalls = totalBalls;
            inningUpdate.totalOvers = overPart;
            inningUpdate.currentBall = String(ballPart || 0); // Update current ball string
          }
        }

        // Explicitly update balls if provided (override calculation from overs)
        if (updateDto.balls !== undefined) {
          inningUpdate.totalBalls = updateDto.balls;
          inningUpdate.totalOvers = Math.floor(updateDto.balls / 6);
        }

        // Update Active Players
        if (updateDto.currentStrikerId) inningUpdate.currentStrikerId = updateDto.currentStrikerId;
        if (updateDto.currentNonStrikerId) inningUpdate.currentNonStrikerId = updateDto.currentNonStrikerId;
        if (updateDto.currentBowlerId) inningUpdate.currentBowlerId = updateDto.currentBowlerId;

        // 3. Apply Updates
        if (Object.keys(matchUpdate).length > 0) {
          await this.matchModel.findByIdAndUpdate(matchObjectId, { $set: matchUpdate }, { session: s });
        }

        if (Object.keys(inningUpdate).length > 0) {
          // Update the current inning (either the one set at start or updated via currentInning)
          // If currentInning was updated in DTO, we already updated match.currentInning and currentInningNum

          await this.inningModel.findOneAndUpdate(
            { matchId: matchObjectId, inningNumber: currentInningNum },
            { $set: inningUpdate },
            { session: s, upsert: true }
          );
        }

        // 4. Return updated status (reuse getLiveStatus logic or construct manually)
        // For performance/simplicity in transaction, we can just return success msg or fetch fresh
        // But getLiveStatus isn't transaction-aware usually.
        // Let's return a basic success object. The frontend usually refetches or we can return mapped data.

        return this.responseService.successWithSingle(
          { ...matchUpdate, ...inningUpdate, matchId }, // Simplified return
          'Live status updated successfully',
          'LIVE_STATUS_UPDATED',
          'Live status updated successfully',
          undefined,
          HttpStatus.OK,
        );
      };

      if (session) {
        return await execute(session);
      }
      return await this.runInTransaction(execute);
    } catch (error) {
      this.logger.error(`updateLiveStatus error:`, error);
      return this.responseService.error(
        'Failed to update live status',
        'LIVE_STATUS_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Switch batting/bowling teams
  async switchTeams(matchId: string, switchDto: SwitchTeamDto): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!Types.ObjectId.isValid(switchDto.battingTeamId) || !Types.ObjectId.isValid(switchDto.bowlingTeamId)) {
        return this.responseService.error(
          'Invalid team IDs',
          'INVALID_TEAM_IDS',
          'Batting and Bowling Team IDs must be valid ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.runInTransaction(async (session) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const battingTeamId = new Types.ObjectId(switchDto.battingTeamId);
        const bowlingTeamId = new Types.ObjectId(switchDto.bowlingTeamId);

        // 1. Get current match state to determine next inning
        const match = await this.matchModel.findById(matchObjectId).session(session);
        if (!match) throw new Error('Match not found');

        // 2. Increment Inning Number (or keep same if we are just switching teams in current inning? 
        // Usually switch teams implies new inning in this context, but if it's just correcting teams, it's same inning.
        // Given previous logic 'Update current inning as well', it implies we might be in existing inning OR creating new.
        // BUT, looking at updateLiveStatus logic, a transition happens.
        // Let's assume this functionality is for "Switching Sides" which typically starts the next inning 
        // OR it might be used to correct the CURRENT inning teams. 
        // The original code updated `liveStatus` and then `currentInning` in `inningModel`. which implies it targeted CURRENT inning.
        // Let's safe guard: If inning 1 is done, it should be inning 2. 
        // If the user manually clicks "Switch Teams", they likely want to Swap Bat/Bowl for the CURRENT inning or Start NEW.
        // The previous implementation updated the *current* inning. So I will maintain that behavior.
        // If they want a NEW inning, they should use 'Start Inning' or similar, or I should increment match.currentInning.
        // However, standard flow is: Inning 1 End -> Switch Teams -> Inning 2 Start.

        // Let's update the CURRENT inning found in match.currentInning.
        const currentInningNum = match.currentInning || 1;

        const updatedInning = await this.inningModel.findOneAndUpdate(
          { matchId: matchObjectId, inningNumber: currentInningNum },
          {
            battingTeamId,
            bowlingTeamId,
          },
          { session, new: true, upsert: true } // Upsert to ensure inning exists
        );

        return this.responseService.successWithSingle(
          { ...updatedInning.toObject(), matchId },
          'Teams switched successfully',
          'TEAMS_SWITCHED',
          'Teams switched successfully',
          undefined,
          HttpStatus.OK,
        );
      });
    } catch (error) {
      this.logger.error(`Failed to switch teams for match ${matchId}. DTO: ${JSON.stringify(switchDto)} Error: ${error.message} Stack: ${error.stack}`, JSON.stringify(error));
      return this.responseService.error(
        'Failed to switch teams',
        'TEAMS_SWITCH_FAILED',
        error.stack,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update toss information
  async updateToss(matchId: string, updateTossDto: UpdateTossDto): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(updateTossDto.winnerId)) {
        return this.responseService.error(
          'Invalid match ID or winner ID',
          'INVALID_ID',
          'Match ID and Winner ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.runInTransaction(async (session) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const winnerObjectId = new Types.ObjectId(updateTossDto.winnerId);

        // Update match with toss information
        const match = await this.matchModel.findByIdAndUpdate(
          matchObjectId,
          {
            $set: {
              toss: {
                tossText: updateTossDto.tossText,
                winnerId: winnerObjectId,
                elected: updateTossDto.elected,
                tossTime: new Date(),
              }
            }
          },
          { new: true, upsert: false, session }
        ).lean();

        // Update LiveMatchStatus with teams from toss
        const matchWithTeams = await this.matchModel.findById(matchObjectId).session(session).lean();
        if (matchWithTeams) {
          let battingTeamId: Types.ObjectId;
          let bowlingTeamId: Types.ObjectId;

          const isWinnerTeamA = winnerObjectId.toString() === matchWithTeams.teamAId.toString();

          if (updateTossDto.elected === 'bat') {
            battingTeamId = winnerObjectId;
            bowlingTeamId = isWinnerTeamA ? matchWithTeams.teamBId as any : matchWithTeams.teamAId as any;
          } else {
            bowlingTeamId = winnerObjectId;
            battingTeamId = isWinnerTeamA ? matchWithTeams.teamBId as any : matchWithTeams.teamAId as any;
          }

          // Update Inning 1 with the correct teams
          await this.inningModel.findOneAndUpdate(
            { matchId: matchObjectId, inningNumber: 1 },
            {
              battingTeamId,
              bowlingTeamId,
            },
            { upsert: true, session }
          );
        }

        const populatedMatch = await this.matchModel.populate(match, {
          path: 'toss.winnerId',
          select: 'name shortName code logo'
        });

        return this.responseService.successWithSingle(
          populatedMatch,
          'Toss information updated successfully',
          'TOSS_UPDATED',
          'Toss information updated successfully',
          undefined,
          HttpStatus.OK,
        );
      });
    } catch (error) {
      return this.responseService.error(
        'Failed to update toss',
        'TOSS_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get match squads
  async getMatchSquads(matchId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const squads = await this.matchSquadModel
        .find({ matchId: new Types.ObjectId(matchId) })
        .populate('teamId', 'name shortName code logo')
        .populate('playingXI', 'name fullName image role')
        .populate('bench', 'name fullName image role')
        .populate('captainId', 'name fullName')
        .populate('viceCaptainId', 'name fullName')
        .populate('wicketKeeperId', 'name fullName')
        .populate('impactPlayerId', 'name fullName')
        .lean();

      return this.responseService.successWithSingle(
        squads,
        'Match squads retrieved successfully',
        'MATCH_SQUADS_RETRIEVED',
        'Match squads retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch match squads',
        'MATCH_SQUADS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update match squad
  async updateMatchSquad(matchId: string, teamId: string, updateDto: UpdateMatchSquadDto): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(teamId)) {
        return this.responseService.error(
          'Invalid match ID or team ID',
          'INVALID_ID',
          'Match ID and Team ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);
      const teamObjectId = new Types.ObjectId(teamId);

      // Convert string arrays to ObjectId arrays
      const updateData: any = {};
      if (updateDto.playingXI) {
        updateData.playingXI = updateDto.playingXI
          .filter(id => Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id));
        if (updateData.playingXI.length !== 11) {
          return this.responseService.error(
            'Playing XI must have exactly 11 players',
            'INVALID_PLAYING_XI',
            'Playing XI must have exactly 11 players',
            undefined,
            null,
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      if (updateDto.bench) {
        updateData.bench = updateDto.bench
          .filter(id => Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id));
      }
      if (updateDto.captainId === null) {
        updateData.captainId = null;
      } else if (updateDto.captainId && Types.ObjectId.isValid(updateDto.captainId)) {
        updateData.captainId = new Types.ObjectId(updateDto.captainId);
      }

      if (updateDto.viceCaptainId === null) {
        updateData.viceCaptainId = null;
      } else if (updateDto.viceCaptainId && Types.ObjectId.isValid(updateDto.viceCaptainId)) {
        updateData.viceCaptainId = new Types.ObjectId(updateDto.viceCaptainId);
      }

      if (updateDto.wicketKeeperId === null) {
        updateData.wicketKeeperId = null;
      } else if (updateDto.wicketKeeperId && Types.ObjectId.isValid(updateDto.wicketKeeperId)) {
        updateData.wicketKeeperId = new Types.ObjectId(updateDto.wicketKeeperId);
      }

      if (updateDto.impactPlayerId === null) {
        updateData.impactPlayerId = null;
      } else if (updateDto.impactPlayerId && Types.ObjectId.isValid(updateDto.impactPlayerId)) {
        updateData.impactPlayerId = new Types.ObjectId(updateDto.impactPlayerId);
      }

      const squad = await this.matchSquadModel.findOneAndUpdate(
        { matchId: matchObjectId, teamId: teamObjectId },
        updateData,
        { new: true, upsert: true }
      )
        .populate('teamId', 'name shortName code logo')
        .populate('playingXI', 'name fullName image role')
        .populate('bench', 'name fullName image role')
        .populate('captainId', 'name fullName')
        .populate('viceCaptainId', 'name fullName')
        .populate('wicketKeeperId', 'name fullName')
        .populate('impactPlayerId', 'name fullName')
        .lean();

      return this.responseService.successWithSingle(
        squad,
        'Match squad updated successfully',
        'MATCH_SQUAD_UPDATED',
        'Match squad updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update match squad',
        'MATCH_SQUAD_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get scorecard for an inning
  async getScorecard(matchId: string, inningNumber: number): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);

      // Check if match exists
      const match = await this.matchModel.findById(matchObjectId).lean();
      if (!match) {
        return this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          `Match with ID ${matchId} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get inning
      const inning = await this.inningModel
        .findOne({ matchId: matchObjectId, inningNumber })
        .populate('battingTeamId', 'name shortName code logo')
        .populate('bowlingTeamId', 'name shortName code logo')
        .lean();

      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          `Inning ${inningNumber} not found for this match. Scorecards are created when the match starts or squads are declared.`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get batting scorecard
      const battingScorecard = await this.battingScorecardModel
        .find({ matchId: matchObjectId, inningId: inning._id })
        .populate('playerId', 'name fullName image role')
        .populate('teamId', 'name shortName code logo')
        .populate('bowlerId', 'name fullName')
        .populate('fielderId', 'name fullName')
        .populate('fielder2Id', 'name fullName')
        .sort({ battingPosition: 1 })
        .lean();

      // Get bowling scorecard
      const bowlingScorecard = await this.bowlingScorecardModel
        .find({ matchId: matchObjectId, inningId: inning._id })
        .populate('playerId', 'name fullName image role')
        .populate('teamId', 'name shortName code logo')
        .sort({ bowlingOrder: 1 })
        .lean();

      return this.responseService.successWithSingle(
        {
          inning,
          batting: battingScorecard,
          bowling: bowlingScorecard,
        },
        'Scorecard retrieved successfully',
        'SCORECARD_RETRIEVED',
        'Scorecard retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch scorecard',
        'SCORECARD_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update batsman stats
  async updateBatsman(matchId: string, inningNumber: number, playerId: string, updateDto: UpdateBatsmanDto, session?: ClientSession): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(playerId)) {
        return this.responseService.error(
          'Invalid match ID or player ID',
          'INVALID_ID',
          'Match ID and Player ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const execute = async (s: ClientSession) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const playerObjectId = new Types.ObjectId(playerId);

        // Validate inning number based on match format
        const validation = await this.validateInningNumber(matchId, inningNumber);
        if (!validation.valid) {
          return validation.error;
        }

        // Get inning
        const inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).session(s);
        if (!inning) {
          return this.responseService.error(
            'Inning not found',
            'INNING_NOT_FOUND',
            `Inning ${inningNumber} not found for this match`,
            undefined,
            null,
            HttpStatus.NOT_FOUND,
          );
        }

        // Convert string IDs to ObjectIds if provided
        const updateData: any = { ...updateDto };
        if (updateDto.bowlerId && Types.ObjectId.isValid(updateDto.bowlerId)) {
          updateData.bowlerId = new Types.ObjectId(updateDto.bowlerId);
        }
        if (updateDto.fielderId && Types.ObjectId.isValid(updateDto.fielderId)) {
          updateData.fielderId = new Types.ObjectId(updateDto.fielderId);
        }
        if (updateDto.fielder2Id && Types.ObjectId.isValid(updateDto.fielder2Id)) {
          updateData.fielder2Id = new Types.ObjectId(updateDto.fielder2Id);
        }

        // Auto-calculate strike rate if in auto mode
        if (updateDto.calculationMode !== 'manual' && updateDto.runs !== undefined && updateDto.balls !== undefined && updateDto.balls > 0) {
          updateData.strikeRate = (updateDto.runs / updateDto.balls) * 100;
        }

        // Get teamId from inning (batting team)
        if (!updateData.teamId) {
          updateData.teamId = inning.battingTeamId;
        }

        // Find or create batting scorecard entry
        const battingScorecard = await this.battingScorecardModel.findOneAndUpdate(
          { matchId: matchObjectId, inningId: inning._id, playerId: playerObjectId },
          updateData,
          { new: true, upsert: true, session: s }
        )
          .populate('playerId', 'name fullName image role')
          .populate('teamId', 'name shortName code logo')
          .populate('bowlerId', 'name fullName')
          .populate('fielderId', 'name fullName')
          .populate('fielder2Id', 'name fullName')
          .lean();

        // If batsman is out, update lastWicket info in the inning
        if (updateData.isOut === true) {
          await this.inningModel.findByIdAndUpdate(inning._id, {
            lastWicket: {
              name: (battingScorecard.playerId as any)?.name || (battingScorecard.playerId as any)?.fullName || 'Unknown',
              dismissal: updateData.dismissalText || battingScorecard.dismissalText || 'out',
              runs: updateData.runs !== undefined ? updateData.runs : battingScorecard.runs,
              balls: updateData.balls !== undefined ? updateData.balls : battingScorecard.balls,
              fours: updateData.fours !== undefined ? updateData.fours : battingScorecard.fours,
              sixes: updateData.sixes !== undefined ? updateData.sixes : battingScorecard.sixes,
              to: updateData.to !== undefined ? updateData.to : (battingScorecard as any).to,
              tr: updateData.tr !== undefined ? updateData.tr : (battingScorecard as any).tr,
              playerId: playerObjectId
            }
          }).session(s);
        }

        return this.responseService.successWithSingle(
          battingScorecard,
          'Batsman stats updated successfully',
          'BATSMAN_UPDATED',
          'Batsman stats updated successfully',
          undefined,
          HttpStatus.OK,
        );
      };

      if (session) {
        return await execute(session);
      }
      return await this.runInTransaction(execute);
    } catch (error) {
      return this.responseService.error(
        'Failed to update batsman stats',
        'BATSMAN_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update bowler stats
  async updateBowler(matchId: string, inningNumber: number, playerId: string, updateDto: UpdateBowlerDto, session?: ClientSession): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(playerId)) {
        return this.responseService.error(
          'Invalid match ID or player ID',
          'INVALID_ID',
          'Match ID and Player ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const execute = async (s: ClientSession) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const playerObjectId = new Types.ObjectId(playerId);

        // Validate inning number based on match format
        const validation = await this.validateInningNumber(matchId, inningNumber);
        if (!validation.valid) {
          return validation.error;
        }

        // Get inning
        const inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).session(s);
        if (!inning) {
          return this.responseService.error(
            'Inning not found',
            'INNING_NOT_FOUND',
            `Inning ${inningNumber} not found for this match`,
            undefined,
            null,
            HttpStatus.NOT_FOUND,
          );
        }

        const updateData: any = { ...updateDto };

        // Auto-calculate stats if in auto mode
        if (updateDto.calculationMode !== 'manual') {
          // Calculate total balls
          if (updateDto.overs !== undefined && updateDto.balls !== undefined) {
            const totalBalls = Math.floor(updateDto.overs) * 6 + (updateDto.overs % 1) * 10 + updateDto.balls;
            updateData.balls = totalBalls;
          }

          // Calculate economy rate
          if (updateDto.runs !== undefined && updateDto.overs !== undefined && updateDto.overs > 0) {
            updateData.economy = updateDto.runs / updateDto.overs;
          }

          // Calculate strike rate (balls per wicket)
          if (updateDto.balls !== undefined && updateDto.wickets !== undefined && updateDto.wickets > 0) {
            updateData.strikeRate = updateDto.balls / updateDto.wickets;
          }

          // Calculate average (runs per wicket)
          if (updateDto.runs !== undefined && updateDto.wickets !== undefined && updateDto.wickets > 0) {
            updateData.average = updateDto.runs / updateDto.wickets;
          }
        }

        // Get teamId from inning (bowling team)
        if (!updateData.teamId) {
          updateData.teamId = inning.bowlingTeamId;
        }

        // Find or create bowling scorecard entry
        const bowlingScorecard = await this.bowlingScorecardModel.findOneAndUpdate(
          { matchId: matchObjectId, inningId: inning._id, playerId: playerObjectId },
          updateData,
          { new: true, upsert: true, session: s }
        )
          .populate('playerId', 'name fullName image role')
          .populate('teamId', 'name shortName code logo')
          .lean();

        return this.responseService.successWithSingle(
          bowlingScorecard,
          'Bowler stats updated successfully',
          'BOWLER_UPDATED',
          'Bowler stats updated successfully',
          undefined,
          HttpStatus.OK,
        );
      };

      if (session) {
        return await execute(session);
      }
      return await this.runInTransaction(execute);
    } catch (error) {
      return this.responseService.error(
        'Failed to update bowler stats',
        'BOWLER_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update inning
  async updateInning(matchId: string, inningNumber: number, updateDto: UpdateInningDto, session?: ClientSession): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const execute = async (s: ClientSession) => {
        const matchObjectId = new Types.ObjectId(matchId);

        // Validate inning number based on match format
        const validation = await this.validateInningNumber(matchId, inningNumber);
        if (!validation.valid) {
          return validation.error;
        }

        // Convert string IDs to ObjectIds if provided
        const updateData: any = { ...updateDto };
        if (updateDto.battingTeamId && Types.ObjectId.isValid(updateDto.battingTeamId)) {
          updateData.battingTeamId = new Types.ObjectId(updateDto.battingTeamId);
        }
        if (updateDto.bowlingTeamId && Types.ObjectId.isValid(updateDto.bowlingTeamId)) {
          updateData.bowlingTeamId = new Types.ObjectId(updateDto.bowlingTeamId);
        }

        if (updateDto.lastWicket && updateDto.lastWicket.playerId && Types.ObjectId.isValid(updateDto.lastWicket.playerId)) {
          updateData.lastWicket = {
            ...updateDto.lastWicket,
            playerId: new Types.ObjectId(updateDto.lastWicket.playerId)
          };
        }

        // Get or create inning first
        let existingInning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).session(s);
        if (!existingInning) {
          // Create inning if it doesn't exist
          const [newInning] = await this.inningModel.create([{
            matchId: matchObjectId,
            inningNumber,
            battingTeamId: updateData.battingTeamId ? new Types.ObjectId(updateData.battingTeamId) : matchObjectId, // Will be updated
            bowlingTeamId: updateData.bowlingTeamId ? new Types.ObjectId(updateData.bowlingTeamId) : matchObjectId, // Will be updated
          }], { session: s });
          existingInning = newInning;
        }

        // Auto-calculate totals if in auto mode
        if (updateDto.calculationMode !== 'manual') {
          // Get all batting scorecards for this inning
          const battingScorecards = await this.battingScorecardModel.find({
            matchId: matchObjectId,
            inningId: existingInning._id,
          }).session(s);

          if (battingScorecards.length > 0) {
            const totalRuns = battingScorecards.reduce((sum, card) => sum + (card.runs || 0), 0);
            const totalWickets = battingScorecards.filter(card => card.isOut).length;
            updateData.totalRuns = totalRuns;
            updateData.totalWickets = totalWickets;

            // Calculate run rate
            if (updateData.totalOvers && updateData.totalOvers > 0) {
              updateData.runRate = totalRuns / updateData.totalOvers;
            }
          }
        }

        const inning = await this.inningModel.findOneAndUpdate(
          { matchId: matchObjectId, inningNumber },
          updateData,
          { new: true, upsert: true, session: s }
        )
          .populate('battingTeamId', 'name shortName code logo')
          .populate('bowlingTeamId', 'name shortName code logo')
          .lean();

        // Also update LiveMatchStatus if this is the current inning (REMOVED: LiveMatchStatus deprecated)
        /*
        const liveStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).session(s);
        if (liveStatus && liveStatus.currentInning === inningNumber) {
          await this.liveMatchStatusModel.findOneAndUpdate(
            { matchId: matchObjectId },
            {
              currentInning: inningNumber,
              lastUpdated: new Date(),
            },
            { session: s }
          );
        }
        */

        return this.responseService.successWithSingle(
          inning,
          'Inning updated successfully',
          'INNING_UPDATED',
          'Inning updated successfully',
          undefined,
          HttpStatus.OK,
        );
      };

      if (session) {
        return await execute(session);
      }
      return await this.runInTransaction(execute);
    } catch (error) {
      return this.responseService.error(
        'Failed to update inning',
        'INNING_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get over summaries for a match and inning
  async getOverSummaries(matchId: string, inningNumber: number): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate inning number based on match format
      const validation = await this.validateInningNumber(matchId, inningNumber);
      if (!validation.valid) {
        return validation.error;
      }

      const matchObjectId = new Types.ObjectId(matchId);

      // Find inning
      const inning = await this.inningModel.findOne({
        matchId: matchObjectId,
        inningNumber,
      });

      if (!inning) {
        return this.responseService.successWithSingle(
          [],
          'No over summaries found',
          'NO_OVER_SUMMARIES',
          'No over summaries found for this inning',
          undefined,
          HttpStatus.OK,
        );
      }

      const overSummaries = await this.overSummaryModel
        .find({
          matchId: matchObjectId,
          inningId: inning._id,
        })
        .populate('bowlerId', 'name fullName')
        .sort({ overNumber: 1 })
        .lean();

      return this.responseService.successWithSingle(
        overSummaries,
        'Over summaries retrieved successfully',
        'OVER_SUMMARIES_RETRIEVED',
        'Over summaries retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch over summaries',
        'OVER_SUMMARIES_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Create or update over summary
  async upsertOverSummary(
    matchId: string,
    inningNumber: number,
    overNumber: number,
    bowlerId: string,
    ballsData: any[],
    session?: ClientSession,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(bowlerId)) {
        return this.responseService.error(
          'Invalid match ID or bowler ID',
          'INVALID_ID',
          'Match ID and bowler ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const execute = async (s: ClientSession) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const bowlerObjectId = new Types.ObjectId(bowlerId);

        // Find inning
        const inning = await this.inningModel.findOne({
          matchId: matchObjectId,
          inningNumber,
        }).session(s);

        if (!inning) {
          return this.responseService.error(
            'Inning not found',
            'INNING_NOT_FOUND',
            `Inning ${inningNumber} not found for this match`,
            undefined,
            null,
            HttpStatus.NOT_FOUND,
          );
        }

        // Calculate runs, wickets, extras from ballsData
        let runs = 0;
        let wickets = 0;
        let extras = 0;

        ballsData.forEach((ball: any) => {
          const ballValue = typeof ball === 'string' ? ball : ball.value || ball;
          if (ballValue === 'W' || ballValue === 'w') {
            wickets++;
          } else if (ballValue === 'wd' || ballValue === 'wide') {
            extras++;
            runs++;
          } else if (ballValue === 'nb' || ballValue === 'no_ball') {
            extras++;
            runs++;
          } else if (ballValue === 'b' || ballValue === 'bye') {
            extras++;
          } else if (ballValue === 'lb' || ballValue === 'leg_bye') {
            extras++;
          } else {
            const runsFromBall = parseInt(ballValue) || 0;
            runs += runsFromBall;
          }
        });

        const isMaiden = runs === 0 && wickets === 0;

        const overSummary = await this.overSummaryModel.findOneAndUpdate(
          {
            matchId: matchObjectId,
            inningId: inning._id,
            overNumber,
          },
          {
            matchId: matchObjectId,
            inningId: inning._id,
            overNumber,
            bowlerId: bowlerObjectId,
            runs,
            wickets,
            extras,
            ballsData,
            isMaiden,
          },
          {
            new: true,
            upsert: true,
            session: s,
          }
        )
          .populate('bowlerId', 'name fullName')
          .lean();

        return this.responseService.successWithSingle(
          overSummary,
          'Over summary saved successfully',
          'OVER_SUMMARY_SAVED',
          'Over summary saved successfully',
          undefined,
          HttpStatus.OK,
        );
      };

      if (session) {
        return await execute(session);
      }
      return await this.runInTransaction(execute);
    } catch (error) {
      return this.responseService.error(
        'Failed to save over summary',
        'OVER_SUMMARY_SAVE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Initialize scorecards from playing XI
  async initializeScorecardsFromSquad(matchId: string, inningNumber: number, teamId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(teamId)) {
        return this.responseService.error(
          'Invalid match ID or team ID',
          'INVALID_ID',
          'Match ID and Team ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate inning number based on match format
      const validation = await this.validateInningNumber(matchId, inningNumber);
      if (!validation.valid) {
        return validation.error;
      }

      return await this.runInTransaction(async (session) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const teamObjectId = new Types.ObjectId(teamId);

        // Get or create inning
        let inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).session(session);

        if (!inning) {
          // Get match to find teams
          const match = await this.matchModel.findById(matchObjectId).session(session).lean();
          if (!match) {
            return this.responseService.error(
              'Match not found',
              'MATCH_NOT_FOUND',
              `Match with ID ${matchId} not found`,
              undefined,
              null,
              HttpStatus.NOT_FOUND,
            );
          }

          // Use teams from Match entity as default if not specified
          // In a real scenario, these should have been set by updateToss or previous innings
          // But for initialization, we can fall back to Match teams if Inning doesn't exist yet.
          // Ideally, Inning 1 is created at match start.

          let battingTeamId = match.teamAId as any;
          let bowlingTeamId = match.teamBId as any;

          // Check if we can infer from previous inning
          if (inningNumber > 1) {
            const prevInning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber: inningNumber - 1 }).session(session);
            if (prevInning) {
              battingTeamId = prevInning.bowlingTeamId;
              bowlingTeamId = prevInning.battingTeamId;
            }
          }

          const [newInning] = await this.inningModel.create([{
            matchId: matchObjectId,
            inningNumber,
            battingTeamId,
            bowlingTeamId,
            totalRuns: 0,
            totalWickets: 0,
            totalOvers: 0,
          }], { session });
          inning = newInning;
        }

        // Get match squad for this team
        const matchSquad = await this.matchSquadModel.findOne({
          matchId: matchObjectId,
          teamId: teamObjectId,
        }).populate('playingXI', 'name fullName role').session(session).lean();

        if (!matchSquad || !matchSquad.playingXI || matchSquad.playingXI.length === 0) {
          return this.responseService.error(
            'Playing XI not found',
            'PLAYING_XI_NOT_FOUND',
            'No playing XI found for this team. Please select playing XI first.',
            undefined,
            null,
            HttpStatus.NOT_FOUND,
          );
        }

        const playerIds = matchSquad.playingXI.map((p: any) =>
          typeof p === 'object' ? p._id : new Types.ObjectId(p)
        );

        // Determine which team this is (batting or bowling)
        const isBattingTeam = inning.battingTeamId?.toString() === teamId;
        const isBowlingTeam = inning.bowlingTeamId?.toString() === teamId;

        // Initialize batting scorecards (manual addition only, as requested by user)
        const battingScorecardsCount = 0;

        // Initialize bowling scorecards (manual addition only, as requested by user)
        const bowlingScorecardsCount = 0;

        return this.responseService.successWithSingle(
          {
            battingScorecardsCreated: 0,
            bowlingScorecardsCreated: 0,
            message: `Inning ${inningNumber} initialized. You can now add players to the scorecard manually.`,
          },
          'Scorecards initialized successfully',
          'SCORECARDS_INITIALIZED',
          'Scorecards initialized successfully',
          undefined,
          HttpStatus.OK,
        );
      });
    } catch (error) {
      return this.responseService.error(
        'Failed to initialize scorecards',
        'SCORECARDS_INITIALIZATION_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  // Get sessions
  async getSessions(matchId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const sessions = await this.liveMatchSessionModel.find({ matchId: new Types.ObjectId(matchId) }).sort({ session: 1 }).lean();

      return this.responseService.successWithSingle(
        sessions,
        'Sessions retrieved successfully',
        'SESSIONS_RETRIEVED',
        'Sessions retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch sessions',
        'SESSIONS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Add session
  async addSession(matchId: string, createDto: CreateSessionDto): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const session = await this.liveMatchSessionModel.create({
        matchId: new Types.ObjectId(matchId),
        ...createDto,
      });

      return this.responseService.successWithSingle(
        session,
        'Session added successfully',
        'SESSION_ADDED',
        'Session added successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to add session',
        'SESSION_ADD_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update session
  async updateSession(matchId: string, sessionId: string, updateDto: UpdateSessionDto): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(sessionId)) {
        return this.responseService.error(
          'Invalid match ID or session ID',
          'INVALID_ID',
          'Match ID and Session ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const session = await this.liveMatchSessionModel.findOneAndUpdate(
        { _id: new Types.ObjectId(sessionId), matchId: new Types.ObjectId(matchId) },
        updateDto,
        { new: true }
      ).lean();

      if (!session) {
        return this.responseService.error(
          'Session not found',
          'SESSION_NOT_FOUND',
          'Session not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        session,
        'Session updated successfully',
        'SESSION_UPDATED',
        'Session updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update session',
        'SESSION_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Delete session
  async deleteSession(matchId: string, sessionId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(sessionId)) {
        return this.responseService.error(
          'Invalid match ID or session ID',
          'INVALID_ID',
          'Match ID and Session ID must be valid MongoDB ObjectIds',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const session = await this.liveMatchSessionModel.findOneAndDelete({
        _id: new Types.ObjectId(sessionId),
        matchId: new Types.ObjectId(matchId)
      });

      if (!session) {
        return this.responseService.error(
          'Session not found',
          'SESSION_NOT_FOUND',
          'Session not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        null,
        'Session deleted successfully',
        'SESSION_DELETED',
        'Session deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete session',
        'SESSION_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Update specific over summary (for editing history)
  async updateOverSummary(
    matchId: string,
    inningNumber: number,
    overNumber: number,
    ballsData: any[],
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);

      // Find inning
      const inning = await this.inningModel.findOne({
        matchId: matchObjectId,
        inningNumber,
      });

      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          `Inning ${inningNumber} not found for this match`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Calculate runs, wickets, extras from ballsData
      let runs = 0;
      let wickets = 0;
      let extras = 0;

      ballsData.forEach((ball: any) => {
        const ballValue = typeof ball === 'string' ? ball : ball.value || ball;
        if (ballValue === 'W' || ballValue === 'w') {
          wickets++;
        } else if (ballValue === 'wd' || ballValue === 'wide') {
          extras++;
          runs++;
        } else if (ballValue === 'nb' || ballValue === 'no_ball') {
          extras++;
          runs++;
        } else if (ballValue === 'b' || ballValue === 'bye') {
          extras++;
        } else if (ballValue === 'lb' || ballValue === 'leg_bye') {
          extras++;
        } else {
          const runsFromBall = parseInt(ballValue) || 0;
          runs += runsFromBall;
        }
      });

      const isMaiden = runs === 0 && wickets === 0;

      const overSummary = await this.overSummaryModel.findOneAndUpdate(
        {
          matchId: matchObjectId,
          inningId: inning._id,
          overNumber,
        },
        {
          runs,
          wickets,
          extras,
          ballsData,
          isMaiden,
        },
        {
          new: true,
        }
      )
        .populate('bowlerId', 'name fullName')
        .lean();

      if (!overSummary) {
        return this.responseService.error(
          'Over summary not found',
          'OVER_SUMMARY_NOT_FOUND',
          'Over summary not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        overSummary,
        'Over summary updated successfully',
        'OVER_SUMMARY_UPDATED',
        'Over summary updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update over summary',
        'OVER_SUMMARY_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Helper method to synchronize striker/non-striker between LiveMatchStatus and BattingScorecard
   * This ensures both systems are always in sync
   */
  private async syncStrikerNonStriker(matchId: Types.ObjectId, inningId: Types.ObjectId, strikerId: Types.ObjectId | null, nonStrikerId: Types.ObjectId | null): Promise<void> {
    // Update Inning
    await this.inningModel.findByIdAndUpdate(
      inningId,
      {
        $set: {
          currentStrikerId: strikerId,
          currentNonStrikerId: nonStrikerId,
        },
      },
    ).exec();

    // Update BattingScorecard flags
    // First, set all batsmen to non-striker
    await this.battingScorecardModel.updateMany(
      { matchId, inningId, isOut: false },
      { $set: { isOnStrike: false } },
    ).exec();

    // Then set the striker flag if striker exists
    if (strikerId) {
      await this.battingScorecardModel.updateOne(
        { matchId, inningId, playerId: strikerId },
        { $set: { isOnStrike: true } },
      ).exec();
    }
  }
  /**
   * Set a batsman as striker (on strike)
   * This will automatically set all other batsmen in the same inning to non-striker
   */
  async setStriker(matchId: string, inningNumber: number, playerId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const validation = await this.validateInningNumber(matchId, inningNumber);
      if (!validation.valid) return validation.error;

      const matchObjectId = new Types.ObjectId(matchId);
      const inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).exec();
      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          'Inning not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      const playerObjectId = new Types.ObjectId(playerId);

      // Super Over Validation: Batter cannot bat if they were dismissed in a previous Super Over match inning
      if (inning.type === 'super_over') {
        const previousSoInnings = await this.inningModel.find({
          matchId: matchObjectId,
          type: 'super_over',
          battingTeamId: inning.battingTeamId,
          inningNumber: { $lt: inning.inningNumber }
        });

        for (const prevInning of previousSoInnings) {
          const pastStats = await this.battingScorecardModel.findOne({
            matchId: matchObjectId,
            inningId: prevInning._id,
            playerId: playerObjectId
          });

          if (pastStats && pastStats.isOut) {
            return this.responseService.error(
              'Batsman ineligible',
              'BATSMAN_INELIGIBLE',
              'This player was dismissed in a previous Super Over and is not eligible to bat again.',
              undefined,
              null,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      // Check if batsman exists and is not out
      const batsman = await this.battingScorecardModel.findOne({
        matchId: matchObjectId,
        inningId: inning._id,
        playerId: playerObjectId,
        isOut: false
      }).populate('playerId', 'name fullName').exec();

      if (!batsman) {
        return this.responseService.error(
          'Batsman not found or already out',
          'BATSMAN_NOT_FOUND',
          'Batsman not found in scorecard or already dismissed',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Find the non-striker (the other active batsman)
      const nonStriker = await this.battingScorecardModel.findOne({
        matchId: matchObjectId,
        inningId: inning._id,
        isOut: false,
        playerId: { $ne: playerObjectId },
      }).exec();

      // Synchronize both systems
      await this.syncStrikerNonStriker(
        matchObjectId,
        inning._id,
        playerObjectId,
        nonStriker?.playerId || null
      );

      return this.responseService.successWithSingle(
        batsman,
        'Striker set successfully',
        'STRIKER_SET',
        'Striker set successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to set striker',
        'SET_STRIKER_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set a batsman as non-striker
   * This ensures only one striker remains (the other active batsman)
   */
  async setNonStriker(matchId: string, inningNumber: number, playerId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const validation = await this.validateInningNumber(matchId, inningNumber);
      if (!validation.valid) return validation.error;

      const matchObjectId = new Types.ObjectId(matchId);
      const inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).exec();
      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          'Inning not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      const playerObjectId = new Types.ObjectId(playerId);

      // Super Over Validation: Batter cannot bat if they were dismissed in a previous Super Over match inning
      if (inning.type === 'super_over') {
        const previousSoInnings = await this.inningModel.find({
          matchId: matchObjectId,
          type: 'super_over',
          battingTeamId: inning.battingTeamId,
          inningNumber: { $lt: inning.inningNumber }
        });

        for (const prevInning of previousSoInnings) {
          const pastStats = await this.battingScorecardModel.findOne({
            matchId: matchObjectId,
            inningId: prevInning._id,
            playerId: playerObjectId
          });

          if (pastStats && pastStats.isOut) {
            return this.responseService.error(
              'Batsman ineligible',
              'BATSMAN_INELIGIBLE',
              'This player was dismissed in a previous Super Over and is not eligible to bat again.',
              undefined,
              null,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      // Check if batsman exists and is not out
      const batsman = await this.battingScorecardModel.findOne({
        matchId: matchObjectId,
        inningId: inning._id,
        playerId: playerObjectId,
        isOut: false
      }).populate('playerId', 'name fullName').exec();

      if (!batsman) {
        return this.responseService.error(
          'Batsman not found or already out',
          'BATSMAN_NOT_FOUND',
          'Batsman not found in scorecard or already dismissed',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Find the other active batsman to set as striker
      const otherBatsman = await this.battingScorecardModel.findOne({
        matchId: matchObjectId,
        inningId: inning._id,
        isOut: false,
        playerId: { $ne: playerObjectId },
      }).exec();

      // Synchronize both systems - set other batsman as striker, this one as non-striker
      await this.syncStrikerNonStriker(
        matchObjectId,
        inning._id,
        otherBatsman?.playerId || null,
        playerObjectId
      );

      return this.responseService.successWithSingle(
        batsman,
        'Non-striker set successfully',
        'NON_STRIKER_SET',
        'Non-striker set successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to set non-striker',
        'SET_NON_STRIKER_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Swap striker and non-striker
   */
  async swapBatsmen(matchId: string, inningNumber: number): Promise<IResponseWithStatusCode<any>> {
    try {
      const validation = await this.validateInningNumber(matchId, inningNumber);
      if (!validation.valid) return validation.error;

      const matchObjectId = new Types.ObjectId(matchId);
      const inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).exec();
      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          'Inning not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Find current striker and non-striker - use Inning IDs first for accuracy
      // const liveStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).exec(); // REMOVED

      let striker = null;
      let nonStriker = null;

      // Try using IDs from Inning first (most reliable)
      if (inning?.currentStrikerId) {
        striker = await this.battingScorecardModel.findOne({
          matchId: matchObjectId,
          inningId: inning._id,
          playerId: inning.currentStrikerId,
          isOut: false,
        }).exec();
      }

      if (inning?.currentNonStrikerId) {
        nonStriker = await this.battingScorecardModel.findOne({
          matchId: matchObjectId,
          inningId: inning._id,
          playerId: inning.currentNonStrikerId,
          isOut: false,
        }).exec();
      }

      // Fallback: find by isOnStrike flag if IDs not available
      if (!striker) {
        striker = await this.battingScorecardModel.findOne({
          matchId: matchObjectId,
          inningId: inning._id,
          isOut: false,
          isOnStrike: true,
        }).exec();
      }

      if (!nonStriker) {
        // Find non-striker - must be actively batting (has faced balls or scored runs)
        nonStriker = await this.battingScorecardModel.findOne({
          matchId: matchObjectId,
          inningId: inning._id,
          isOut: false,
          isOnStrike: false,
          $or: [
            { runs: { $gt: 0 } },
            { balls: { $gt: 0 } },
          ],
        }).exec();
      }

      if (!striker || !nonStriker) {
        return this.responseService.error(
          'Both batsmen must be set',
          'BATSMEN_NOT_SET',
          'Both striker and non-striker must be set before swapping. Please set both batsmen first.',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Ensure they are different players
      if (striker.playerId.toString() === nonStriker.playerId.toString()) {
        return this.responseService.error(
          'Cannot swap same player',
          'SAME_PLAYER',
          'Striker and non-striker must be different players',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Synchronize both systems - swap the IDs
      await this.syncStrikerNonStriker(
        matchObjectId,
        inning._id,
        nonStriker.playerId, // Former non-striker becomes striker
        striker.playerId     // Former striker becomes non-striker
      );

      return this.responseService.success(
        { message: 'Batsmen swapped successfully' },
        'Batsmen swapped successfully',
        'BATSMEN_SWAPPED',
        'Batsmen swapped successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to swap batsmen',
        'SWAP_BATSMEN_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set a bowler as current bowler
   * This will automatically set all other bowlers in the same inning to not current
   */
  async setCurrentBowler(matchId: string, inningNumber: number, playerId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const validation = await this.validateInningNumber(matchId, inningNumber);
      if (!validation.valid) return validation.error;

      const matchObjectId = new Types.ObjectId(matchId);
      const inning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber }).exec();
      if (!inning) {
        return this.responseService.error(
          'Inning not found',
          'INNING_NOT_FOUND',
          'Inning not found',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      const playerObjectId = new Types.ObjectId(playerId);

      // Super Over Validation: Bowler cannot bowl if they bowled in a previous Super Over match inning
      if (inning.type === 'super_over') {
        const previousSoInnings = await this.inningModel.find({
          matchId: matchObjectId,
          type: 'super_over',
          bowlingTeamId: inning.bowlingTeamId,
          inningNumber: { $lt: inning.inningNumber }
        });

        // Note: This method doesn't take a session argument in signature, but calling model.find without session is fine if not inside transaction.
        // If this method is called inside a transaction (it is not wrapped in runInTransaction here), we might need consistency.
        // But for reading past innings, standard find is okay.

        for (const prevInning of previousSoInnings) {
          const pastStats = await this.bowlingScorecardModel.findOne({
            matchId: matchObjectId,
            inningId: prevInning._id,
            playerId: playerObjectId
          });

          if (pastStats && (pastStats.balls > 0 || pastStats.overs > 0)) {
            return this.responseService.error(
              'Bowler ineligible',
              'BOWLER_INELIGIBLE',
              'This player bowled in a previous Super Over and is not eligible to bowl again.',
              undefined,
              null,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      // Set all bowlers in this inning to not current first
      await this.bowlingScorecardModel.updateMany(
        { matchId: matchObjectId, inningId: inning._id },
        { $set: { isCurrentBowler: false } },
      ).exec();

      // Set the selected bowler as current
      const bowler = await this.bowlingScorecardModel.findOneAndUpdate(
        { matchId: matchObjectId, inningId: inning._id, playerId: playerObjectId },
        { $set: { isCurrentBowler: true } },
        { new: true },
      ).populate('playerId', 'name fullName').exec();

      if (!bowler) {
        return this.responseService.error(
          'Bowler not found',
          'BOWLER_NOT_FOUND',
          'Bowler not found in scorecard',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Update Inning with currentBowlerId
      await this.inningModel.findByIdAndUpdate(
        inning._id,
        { $set: { currentBowlerId: playerObjectId } },
        { session: null } // Explicitly null if not in transaction
      ).exec();

      return this.responseService.successWithSingle(
        { bowler },
        'Current bowler set successfully',
        'CURRENT_BOWLER_SET',
        'Current bowler set successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to set current bowler',
        'SET_CURRENT_BOWLER_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== COMMENTARY METHODS ====================

  /**
   * Get match commentary (all or for specific inning)
   */
  async getMatchCommentary(matchId: string, inningId?: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);
      const query: any = { matchId: matchObjectId };

      if (inningId && Types.ObjectId.isValid(inningId)) {
        query.inningId = new Types.ObjectId(inningId);
      }

      const summaries = await this.overSummaryModel
        .find(query)
        .sort({ overNumber: -1 }) // Recent overs first
        .lean();

      // Flatten and transform ballsData into a flat commentary list
      const commentary: any = [];
      summaries.forEach(over => {
        // Add over end highlight if it exists
        if (over.overHighlight) {
          commentary.push({
            ...over.overHighlight,
            _id: over.overHighlight.ballId?.toString() || over.overHighlight.ballId,
            ballId: over.overHighlight.ballId?.toString() || over.overHighlight.ballId,
            overNumber: over.overNumber,
            inningId: over.inningId,
            matchId: over.matchId,
          });
        }

        if (over.ballsData && Array.isArray(over.ballsData)) {
          // We want the balls within an over to be in reverse order too (most recent first)
          const overBalls = [...over.ballsData].reverse().map(ball => ({
            ...ball,
            _id: ball.ballId?.toString() || ball.ballId, // Map ballId to _id for frontend compatibility
            ballId: ball.ballId?.toString() || ball.ballId, // Convert ObjectId to string
            overNumber: over.overNumber,
            inningId: over.inningId,
            matchId: over.matchId,
          }));
          commentary.push(...overBalls);
        }
      });

      return this.responseService.successWithSingle(
        commentary,
        'Commentary retrieved successfully',
        'COMMENTARY_RETRIEVED',
        'Commentary retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch commentary',
        'COMMENTARY_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update commentary text
   * Note: commentaryId here refers to the ballId within an OverSummary
   */
  /**
   * Update commentary text
   * Note: commentaryId here refers to the ballId within an OverSummary
   */
  async updateCommentary(commentaryId: string, commentary: string, matchId?: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const idQuery = Types.ObjectId.isValid(commentaryId)
        ? [new Types.ObjectId(commentaryId), commentaryId]
        : [commentaryId];

      const query: any = {
        $or: [
          { 'ballsData.ballId': { $in: idQuery } },
          { 'overHighlight.ballId': { $in: idQuery } }
        ]
      };

      if (matchId && Types.ObjectId.isValid(matchId)) {
        query.matchId = { $in: [new Types.ObjectId(matchId), matchId] };
      }

      // Find the over summary that contains this ballId
      const overSummary = await this.overSummaryModel.findOne(query);

      if (!overSummary) {
        return this.responseService.error(
          'Commentary not found',
          'COMMENTARY_NOT_FOUND',
          'Commentary with the provided ID does not exist in any over summary',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Update the ball in ballsData
      let modified = false;
      if (overSummary.ballsData && Array.isArray(overSummary.ballsData)) {
        overSummary.ballsData.forEach((b: any) => {
          if (b.ballId?.toString() === commentaryId || b.ballId === commentaryId) {
            b.commentary = commentary;
            modified = true;
          }
        });
        if (modified) overSummary.markModified('ballsData');
      }

      // Check overHighlight independently (not else if)
      if (overSummary.overHighlight?.ballId?.toString() === commentaryId || overSummary.overHighlight?.ballId === commentaryId) {
        overSummary.overHighlight.commentary = commentary;
        overSummary.markModified('overHighlight');
        modified = true;
      }

      if (modified) {
        await (overSummary as any).save();
      }

      const updatedBall = overSummary.ballsData?.find((b: any) =>
        b.ballId?.toString() === commentaryId || b.ballId === commentaryId
      );

      const responseData = updatedBall || overSummary.overHighlight;

      return this.responseService.successWithSingle(
        { ...responseData, _id: responseData?.ballId || commentaryId },
        'Commentary updated successfully',
        'COMMENTARY_UPDATED',
        'Commentary updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update commentary',
        'COMMENTARY_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete commentary
   */
  async deleteCommentary(commentaryId: string, matchId?: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const idQuery = Types.ObjectId.isValid(commentaryId)
        ? [new Types.ObjectId(commentaryId), commentaryId]
        : [commentaryId];

      const query: any = {
        $or: [
          { 'ballsData.ballId': { $in: idQuery } },
          { 'overHighlight.ballId': { $in: idQuery } }
        ]
      };

      if (matchId && Types.ObjectId.isValid(matchId)) {
        query.matchId = { $in: [new Types.ObjectId(matchId), matchId] };
      }

      const overSummary = await this.overSummaryModel.findOne(query);

      if (!overSummary) {
        return this.responseService.error(
          'Commentary not found',
          'COMMENTARY_NOT_FOUND',
          'Commentary with the provided ID does not exist in any over summary',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // For deletion, if it's a "ball" type, we just clear the text to preserve the ball record
      // If it's a highlight type, we could remove it entirely.
      // Remove matching entries from ballsData
      let modified = false;
      if (overSummary.ballsData && Array.isArray(overSummary.ballsData)) {
        const initialLength = overSummary.ballsData.length;
        overSummary.ballsData = overSummary.ballsData.filter((b: any) =>
          b.ballId?.toString() !== commentaryId && b.ballId !== commentaryId
        );

        if (overSummary.ballsData.length !== initialLength) {
          overSummary.markModified('ballsData');
          modified = true;
        }
      }

      // Check overHighlight separately (not else if)
      if (overSummary.overHighlight?.ballId?.toString() === commentaryId || overSummary.overHighlight?.ballId === commentaryId) {
        overSummary.overHighlight = null;
        overSummary.markModified('overHighlight');
        modified = true;
      }

      if (modified) {
        await (overSummary as any).save();
      }

      return this.responseService.successWithSingle(
        { deleted: true, commentaryId },
        'Commentary deleted successfully',
        'COMMENTARY_DELETED',
        'Commentary deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete commentary',
        'COMMENTARY_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Evaluate Match Outcome
  async evaluateMatchOutcome(matchId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const matchObjectId = new Types.ObjectId(matchId);
      const match = await this.matchModel.findById(matchObjectId);
      if (!match) {
        return this.responseService.error('Match not found', 'MATCH_NOT_FOUND', 'Match not found', undefined, null, HttpStatus.NOT_FOUND);
      }

      // Get all innings
      const innings = await this.inningModel.find({ matchId: matchObjectId }).sort({ inningNumber: 1 });

      // Basic validation: Need at least 2 completed innings for a result (except No Result)
      if (innings.length < 2) {
        return this.responseService.error('Insufficient innings', 'INSUFFICIENT_INNINGS', 'Match must have at least 2 innings to evaluate result', undefined, null, HttpStatus.BAD_REQUEST);
      }

      // Identify main innings (not super overs)
      const mainInnings = innings.filter(i => i.type !== 'super_over');
      const superOverInnings = innings.filter(i => i.type === 'super_over');

      let resultType = 'normal';
      let winBy = '';
      let margin = 0;
      let winnerId = null;
      let resultText = '';
      let losingTeamId = null;

      // Logic for Normal Match (2 innings or Test 4)
      if (mainInnings.length >= 2) {
        const inn1 = mainInnings[0];
        const inn2 = mainInnings[1];

        // Simple run comparison for T20/ODI/Limited Overs
        if (inn2.totalRuns > inn1.totalRuns) {
          // Team Batting Second Won
          winnerId = inn2.battingTeamId;
          losingTeamId = inn2.bowlingTeamId;
          resultType = 'normal';
          winBy = 'wickets';
          margin = 10 - inn2.totalWickets; // Assuming 10 wickets
          resultText = `${(await this.getTeamName(winnerId))} won by ${margin} wickets`;
        } else if (inn2.totalRuns < inn1.totalRuns) {
          // Team Batting First Won
          winnerId = inn1.battingTeamId;
          losingTeamId = inn1.bowlingTeamId;
          resultType = 'normal';
          winBy = 'runs';
          margin = inn1.totalRuns - inn2.totalRuns;
          resultText = `${(await this.getTeamName(winnerId))} won by ${margin} runs`;
        } else {
          // TIE
          resultType = 'tie';
          winBy = 'tie';
          resultText = 'Match Tied';

          // Format Specific Rules
          if (['t20', 't20i', 'hundred', 't10'].includes(match.matchFormat)) {
            // T20/Hundred Tie -> Super Over
            resultText = 'Match Tied (Super Over Required)';
            // We don't set winnerId yet

            // If Super Overs exist, check them
            if (superOverInnings.length > 0) {
              // Super Overs come in pairs (Inn 3 & 4, or 5 & 6)
              // If we have an even number of SO innings, we can evaluate the latest pair
              if (superOverInnings.length % 2 === 0) {
                const soInn1 = superOverInnings[superOverInnings.length - 2];
                const soInn2 = superOverInnings[superOverInnings.length - 1];

                if (soInn2.totalRuns > soInn1.totalRuns) {
                  winnerId = soInn2.battingTeamId;
                  losingTeamId = soInn2.bowlingTeamId;
                  resultType = 'super_over';
                  winBy = 'wickets';
                  resultText = `${(await this.getTeamName(winnerId))} won by Super Over`;
                } else if (soInn2.totalRuns < soInn1.totalRuns) {
                  winnerId = soInn1.battingTeamId;
                  losingTeamId = soInn1.bowlingTeamId;
                  resultType = 'super_over';
                  winBy = 'runs';
                  resultText = `${(await this.getTeamName(winnerId))} won by Super Over`;
                } else {
                  // Super Over Tied -> Infinite Loop Clause
                  resultText = 'Super Over Tied (Subsequent Super Over Required)';
                  // No winner yet
                }
              }
            }
          } else {
            // ODI / Test Tie -> Standard Tie
            // (Unless ODI knockout, but assuming standard for now)
          }
        }
      }

      // Save Result
      match.result = {
        winnerId,
        resultType,
        winBy,
        margin,
        resultText,
        winningTeamId: winnerId,
        losingTeamId,
      };

      await match.save();

      return this.responseService.successWithSingle(
        match.result,
        'Match outcome evaluated',
        'MATCH_EVALUATED',
        resultText,
        undefined,
        HttpStatus.OK,
      );

    } catch (error) {
      this.logger.error(`evaluateMatchOutcome error:`, error);
      return this.responseService.error(
        'Failed to evaluate match',
        'MATCH_EVALUATION_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getTeamName(teamId: Types.ObjectId): Promise<string> {
    if (!teamId) return 'Team';
    const team = await this.matchModel.db.collection('teams').findOne({ _id: teamId });
    return team ? team.name : 'Team';
  }

  // Start Super Over
  async startSuperOver(matchId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(matchId)) {
        return this.responseService.error(
          'Invalid match ID',
          'INVALID_MATCH_ID',
          'Match ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.runInTransaction(async (session) => {
        const matchObjectId = new Types.ObjectId(matchId);

        const match = await this.matchModel.findById(matchObjectId).session(session);
        if (!match) {
          throw new Error('Match not found');
        }

        // Increment Super Over count
        const superOverCount = (match.superOverCount || 0) + 1;

        // Determine next inning number (usually current + 1)
        const lastInning = await this.inningModel.findOne({ matchId: matchObjectId }).sort({ inningNumber: -1 }).session(session);
        const nextInningNumber = (lastInning?.inningNumber || 2) + 1;

        // Determine teams for Super Over
        // Rule: Team batting second in the main match bats first in Super Over 1
        // Rule: In subsequent Super Overs, teams swap order from strictly previous Super over.

        let battingTeamId: any;
        let bowlingTeamId: any;

        if (superOverCount === 1) {
          // Find main match 2nd innings to see who batted
          const mainInnings = await this.inningModel.find({ matchId: matchObjectId, type: { $ne: 'super_over' } }).sort({ inningNumber: 1 }).session(session);
          if (mainInnings.length >= 2) {
            const inn2 = mainInnings[1];
            battingTeamId = inn2.battingTeamId; // Team B bats first in SO
            bowlingTeamId = inn2.bowlingTeamId;
          } else {
            // Fallback
            battingTeamId = match.teamBId;
            bowlingTeamId = match.teamAId;
          }
        } else {
          // Subsequent Super Over: Swap from previous Super Over
          // Find last Super Over innings (pair)
          const lastSoInnings = await this.inningModel.find({ matchId: matchObjectId, type: 'super_over' }).sort({ inningNumber: -1 }).limit(2).session(session);

          // In previous SO, we look at who batted FIRST in that pair (the odd number in the pair).
          // But simpler: just look at the last inning (SO Inn 2). 
          // Whoever batted in SO Inn 2 (the chase) will BOWL in the next SO Inn 1.
          // So whoever BOWLED in SO Inn 2 (defending) will BAT in the next SO Inn 1.

          if (lastSoInnings.length > 0) {
            const lastInning = lastSoInnings[0]; // This is the last created inning (SO Inn 2)
            // In SO Inn 2: battingTeamId was chasing. bowlingTeamId was defending.
            // Next SO (Inn 1): Defending team (bowlingTeamId of last inning) bats first.
            battingTeamId = lastInning.bowlingTeamId;
            bowlingTeamId = lastInning.battingTeamId;
          } else {
            battingTeamId = match.teamAId;
            bowlingTeamId = match.teamBId;
          }
        }

        // Create Inning 1 of Super Over
        const soInning1 = new this.inningModel({
          matchId: matchObjectId,
          inningNumber: nextInningNumber,
          type: 'super_over',
          superOverNumber: superOverCount,
          battingTeamId,
          bowlingTeamId,
          totalRuns: 0,
          totalWickets: 0,
          totalBalls: 0,
          totalOvers: 0,
          status: 'ongoing',
        });
        await soInning1.save({ session });

        // Create Inning 2 of Super Over
        const soInning2 = new this.inningModel({
          matchId: matchObjectId,
          inningNumber: nextInningNumber + 1,
          type: 'super_over',
          superOverNumber: superOverCount,
          battingTeamId: bowlingTeamId, // Swap
          bowlingTeamId: battingTeamId,
          totalRuns: 0,
          totalWickets: 0,
          totalBalls: 0,
          totalOvers: 0,
          status: 'pending',
        });
        await soInning2.save({ session });

        // Update Match to point to new current Inning and update status
        const updatedMatch = await this.matchModel.findByIdAndUpdate(
          matchObjectId,
          {
            $set: {
              superOverCount,
              currentInning: nextInningNumber,
              status: 'live', // Ensure match is live
              'result.resultType': 'super_over', // Mark result as super over in progress
              'result.resultText': `Super Over ${superOverCount} in progress`,
            },
            $inc: { totalInnings: 2 }
          },
          { session, new: true }
        );

        this.logger.log(`Super Over started. Match updated: Total Innings = ${updatedMatch.totalInnings}, Current Inning = ${updatedMatch.currentInning}`);

        return this.responseService.successWithSingle(
          {
            superOverCount,
            currentInning: nextInningNumber,
            battingTeamId,
            bowlingTeamId
          },
          'Super Over started successfully',
          'SUPER_OVER_STARTED',
          'Super Over started successfully',
          undefined,
          HttpStatus.OK,
        );
      });
    } catch (error) {
      this.logger.error(`startSuperOver error:`, error);
      return this.responseService.error(
        'Failed to start Super Over',
        'SUPER_OVER_START_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Check and conclude match if result is reached
  async checkMatchConclusion(matchId: string): Promise<boolean> {
    try {
      const matchObjectId = new Types.ObjectId(matchId);
      const match = await this.matchModel.findById(matchObjectId).lean();
      if (!match || match.status === 'completed') return false;

      // Only applicable for limited overs (ODI/T20) generally, but let's be generic
      // We need to check if we are in the last inning (usually 2nd) and if a result is reached.
      // For Test matches, it's more complex (4 innings), so we might restrict auto-conclusion to non-test for now
      // OR handle 4th inning targets.

      // Let's focus on 2nd inning chase (or 4th for Test)
      // Generic check: If inning has a target, we can check conclusion
      // if (match.currentInning !== 2 && match.matchFormat !== 'test') return false;
      // For Super Over, inning might be 3/4, handled separately by startSuperOver usually, 
      // but if we want to auto-conclude a super over chase:
      // const isSuperOverChase = (match.currentInning % 2 === 0) && (match.result?.resultType === 'super_over' || match.matchFormat === 't20' || match.matchFormat === 'odi');

      // Load innings
      const innings = await this.inningModel.find({ matchId: matchObjectId }).sort({ inningNumber: 1 }).lean();

      // Basic 2-inning chase logic
      if (innings.length >= 2) {
        const firstInning = innings[innings.length - 2]; // Previous inning (Target setter)
        const secondInning = innings[innings.length - 1]; // Current inning (Chaser)
        if ((secondInning as any).originalInningNumber !== undefined && (secondInning as any).originalInningNumber !== match.currentInning) {
          // Mismatch or something, skip
        }

        // Determine Target: Use explicit target from inning if available, otherwise calculate from previous inning
        // This supports Test matches (4th inning target) and D/L methods if target is set on Inning entity
        let target = secondInning.target;
        if (!target || target === 0) {
          // Fallback for standard limited overs: Target = Inning 1 Runs + 1
          if (match.matchFormat !== 'test') {
            target = firstInning.totalRuns + 1;
          } else {
            // For Test matches without explicit target, we CANNOT auto-conclude currently.
            return false;
          }
        }

        const currentRuns = secondInning.totalRuns;
        const wicketsDown = secondInning.totalWickets;
        // const totalWickets = 10; // Standard, unless stated otherwise (e.g. 2 for Super Over)

        // Check for Super Over limits
        const isSuperOver = match.currentInning > 2 && (match.result?.resultType === 'super_over' || firstInning.type === 'super_over');
        const maxWickets = isSuperOver ? 2 : 10;
        const ballsPerOver = match.ballsPerOver || 6;
        // For Test matches, overs are usually unlimited (or large), so maxOvers check should be skipped or high
        const maxOvers = isSuperOver ? 1 : (match.oversPerInning || 9999);
        const maxBalls = maxOvers * ballsPerOver;

        // 1. Chasing team wins
        if (target && currentRuns >= target) {
          this.logger.log(`Match ${matchId} Auto-Conclusion: Chasing team won (Runs ${currentRuns} >= Target ${target})`);
          await this.evaluateMatchOutcome(matchId);
          return true;
        }

        // 2. Bowling team wins (All out or Overs finished) - AND score is less than target
        if (wicketsDown >= maxWickets || secondInning.totalBalls >= maxBalls) {
          if (currentRuns < target - 1) { // Lost
            this.logger.log(`Match ${matchId} Auto-Conclusion: Bowling team won (Runs ${currentRuns} < Target ${target})`);
            await this.evaluateMatchOutcome(matchId);
            return true;
          } else if (currentRuns === target - 1) { // Tie
            this.logger.log(`Match ${matchId} Auto-Conclusion: Tie detected`);
            await this.evaluateMatchOutcome(matchId);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`Error in checkMatchConclusion: ${error.message}`);
      return false;
    }
  }
}
