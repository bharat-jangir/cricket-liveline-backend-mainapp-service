import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';
import { LiveMatchStatus } from '../../entities/live-match-status.entity';
import { Match } from '../../entities/match.entity';
import { Inning } from '../../entities/inning.entity';
import { BattingScorecard } from '../../entities/batting-scorecard.entity';
import { BowlingScorecard } from '../../entities/bowling-scorecard.entity';
import { MatchSquad } from '../../entities/match-squad.entity';
import { OverSummary } from '../../entities/over-summary.entity';
import { MatchDetails } from '../../entities/match-details.entity';
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
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class LiveMatchService {
  private readonly logger = new Logger(LiveMatchService.name);

  constructor(
    @InjectModel(LiveMatchStatus.name) private liveMatchStatusModel: Model<LiveMatchStatus>,
    @InjectModel(Match.name) private matchModel: Model<Match>,
    @InjectModel(Inning.name) private inningModel: Model<Inning>,
    @InjectModel(BattingScorecard.name) private battingScorecardModel: Model<BattingScorecard>,
    @InjectModel(BowlingScorecard.name) private bowlingScorecardModel: Model<BowlingScorecard>,
    @InjectModel(MatchSquad.name) private matchSquadModel: Model<MatchSquad>,
    @InjectModel(OverSummary.name) private overSummaryModel: Model<OverSummary>,
    @InjectModel(MatchDetails.name) private matchDetailsModel: Model<MatchDetails>,
    @InjectModel(LiveMatchSession.name) private liveMatchSessionModel: Model<LiveMatchSession>,
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
    if (match.matchFormat !== 'test' && inningNumber > 2) {
      return {
        valid: false,
        error: this.responseService.error(
          'Invalid inning number for match format',
          'INVALID_INNING_NUMBER',
          `${match.matchFormat.toUpperCase()} matches can only have 2 innings. Innings 3 and 4 are only allowed for test matches.`,
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        ),
      };
    }

    return { valid: true };
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

      const [liveStatusDoc, matchDetails] = await Promise.all([
        this.liveMatchStatusModel
          .findOne({ matchId: new Types.ObjectId(matchId) })
          .populate('battingTeamId', 'name shortName code logo')
          .populate('bowlingTeamId', 'name shortName code logo')
          .lean(),
        this.matchDetailsModel
          .findOne({ matchId: new Types.ObjectId(matchId) })
          .select('toss')
          .populate('toss.winnerId', 'name shortName code logo')
          .lean()
      ]);

      if (!liveStatusDoc) {
        // Even if live status doesn't exist, we might have match details with toss
        if (matchDetails && matchDetails.toss) {
          return this.responseService.successWithSingle(
            { toss: matchDetails.toss },
            'Toss information retrieved',
            'TOSS_RETRIEVED',
            'Toss information retrieved',
            undefined,
            HttpStatus.OK,
          );
        }

        // Return default status if not found
        return this.responseService.successWithSingle(
          null,
          'Live status not found for this match',
          'LIVE_STATUS_NOT_FOUND',
          'Live status not found for this match',
          undefined,
          HttpStatus.OK,
        );
      }

      // Merge toss into liveStatus
      const liveStatus = {
        ...liveStatusDoc,
        toss: matchDetails?.toss || undefined,
      };

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
        const liveStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).lean();
        targetInning = liveStatus?.currentInning || 1;
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

        // Convert string IDs to ObjectIds if provided
        const updateData: any = { ...updateDto };
        if (updateDto.battingTeamId && Types.ObjectId.isValid(updateDto.battingTeamId)) {
          updateData.battingTeamId = new Types.ObjectId(updateDto.battingTeamId);
        }
        if (updateDto.bowlingTeamId && Types.ObjectId.isValid(updateDto.bowlingTeamId)) {
          updateData.bowlingTeamId = new Types.ObjectId(updateDto.bowlingTeamId);
        }

        // Check if currentInning is being updated and we need to handle transitions
        if (updateData.currentInning !== undefined) {
          try {
            const existingStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).session(s);
            if (existingStatus && existingStatus.currentInning !== updateData.currentInning) {
              // Check if target inning already exists in the database
              const targetInning = await this.inningModel.findOne({
                matchId: matchObjectId,
                inningNumber: updateData.currentInning
              }).session(s);

              if (!targetInning) {
                // NEW INNING: Apply swap logic and reset stats only if teams not explicitly provided
                if (updateData.currentInning > existingStatus.currentInning) {
                  if (updateData.battingTeamId === undefined && updateData.bowlingTeamId === undefined) {
                    updateData.battingTeamId = existingStatus.bowlingTeamId;
                    updateData.bowlingTeamId = existingStatus.battingTeamId;

                    // Reset live stats for new inning
                    updateData.score = "0/0";
                    updateData.overs = "0.0";
                    updateData.balls = 0;
                    updateData.currentOver = 0;
                    updateData.currentBall = 0;
                    updateData.runRate = 0;
                    updateData.requiredRunRate = 0;
                    updateData.target = 0;
                    updateData.ballsRemaining = 0;
                  }
                }
              } else {
                // EXISTING INNING: Sync live status with existing inning data only if teams not explicitly provided
                if (updateData.battingTeamId === undefined && updateData.bowlingTeamId === undefined) {
                  updateData.battingTeamId = targetInning.battingTeamId;
                  updateData.bowlingTeamId = targetInning.bowlingTeamId;

                  // Sync stats from existing inning record
                  updateData.score = `${targetInning.totalRuns}/${targetInning.totalWickets}`;
                  const totalOvers = Math.floor(targetInning.totalBalls / 6);
                  const remainderBalls = targetInning.totalBalls % 6;
                  updateData.overs = `${totalOvers}.${remainderBalls}`;
                  updateData.balls = targetInning.totalBalls;
                  updateData.currentOver = totalOvers;
                  updateData.currentBall = remainderBalls;
                }
              }
            }
          } catch (inningError) {
            this.logger.error('Error in inning transition logic:', inningError);
            // Continue with basic update if inning logic fails
          }
        }

        // Sync scoreboard updates to Inning entity to prevent ScoreEngine from reverting manual changes
        if (updateData.score || updateData.overs) {
          this.logger.log(`[SYNC] Manual scoreboard update detected for match ${matchId}: score=${updateData.score}, overs=${updateData.overs}`);
          try {
            const currentStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).session(s);
            const inningNum = (updateData.currentInning !== undefined) ? updateData.currentInning : (currentStatus?.currentInning || 1);
            this.logger.log(`[SYNC] Target Inning: ${inningNum}`);

            const inningUpdate: any = {};

            if (updateData.score) {
              const [runs, wickets] = updateData.score.split('/').map(n => parseInt(n, 10));
              if (!isNaN(runs)) inningUpdate.totalRuns = runs;
              if (!isNaN(wickets)) inningUpdate.totalWickets = wickets;
            }

            if (updateData.overs) {
              const [overPart, ballPart] = updateData.overs.split('.').map(n => parseInt(n, 10));
              if (!isNaN(overPart)) {
                const totalBalls = (overPart * 6) + (ballPart || 0);
                inningUpdate.totalBalls = totalBalls;
                inningUpdate.totalOvers = overPart;

                // Update LiveMatchStatus fields for immediate consistency
                updateData.balls = totalBalls;
                updateData.currentOver = overPart;
                updateData.currentBall = String(ballPart || 0);
              }
            }

            if (Object.keys(inningUpdate).length > 0) {
              this.logger.log(`[SYNC] Updating Inning ${inningNum} for match ${matchId} with data: ${JSON.stringify(inningUpdate)}`);

              // Verify if inning exists before update for better logging
              const existingInning = await this.inningModel.findOne({ matchId: matchObjectId, inningNumber: inningNum }).session(s);
              if (!existingInning) {
                this.logger.warn(`[SYNC] WARNING: Inning ${inningNum} not found in DB for match ${matchId}. Score sync might fail.`);
              } else {
                this.logger.log(`[SYNC] Current Inning values: totalRuns=${existingInning.totalRuns}, totalBalls=${existingInning.totalBalls}`);
              }

              const updatedInning = await this.inningModel.findOneAndUpdate(
                { matchId: matchObjectId, inningNumber: inningNum },
                { $set: inningUpdate },
                { session: s, new: true, upsert: true } // Use upsert: true to be safe, though it should exist
              );

              if (updatedInning) {
                this.logger.log(`[SYNC] Success: Inning ${inningNum} updated. New totalRuns=${updatedInning.totalRuns}, totalBalls=${updatedInning.totalBalls}`);
              }
            }
          } catch (syncError) {
            this.logger.error(`[SYNC] ERROR during synchronization: ${syncError.message}`, syncError.stack);
          }
        }

        // Update or create live status
        const liveStatus = await this.liveMatchStatusModel.findOneAndUpdate(
          { matchId: matchObjectId },
          {
            ...updateData,
            lastUpdated: new Date(),
          },
          { new: true, upsert: true, session: s }
        )
          .populate('battingTeamId', 'name shortName code logo')
          .populate('bowlingTeamId', 'name shortName code logo')
          .lean();

        this.logger.log(`Updated live status:`, JSON.stringify(liveStatus));

        return this.responseService.successWithSingle(
          liveStatus,
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

      return await this.runInTransaction(async (session) => {
        const matchObjectId = new Types.ObjectId(matchId);
        const battingTeamId = new Types.ObjectId(switchDto.battingTeamId);
        const bowlingTeamId = new Types.ObjectId(switchDto.bowlingTeamId);

        // Update live status
        const liveStatus = await this.liveMatchStatusModel.findOneAndUpdate(
          { matchId: matchObjectId },
          {
            battingTeamId,
            bowlingTeamId,
            lastUpdated: new Date(),
          },
          { new: true, upsert: true, session }
        )
          .populate('battingTeamId', 'name shortName code logo')
          .populate('bowlingTeamId', 'name shortName code logo')
          .lean();

        // Update current inning as well to ensure consistency
        // This allows initializeScorecardsFromSquad to work correctly
        const currentInning = liveStatus.currentInning || 1;
        await this.inningModel.findOneAndUpdate(
          { matchId: matchObjectId, inningNumber: currentInning },
          {
            battingTeamId,
            bowlingTeamId,
          },
          { session }
        );

        return this.responseService.successWithSingle(
          liveStatus,
          'Teams switched successfully',
          'TEAMS_SWITCHED',
          'Teams switched successfully',
          undefined,
          HttpStatus.OK,
        );
      });
    } catch (error) {
      return this.responseService.error(
        'Failed to switch teams',
        'TEAMS_SWITCH_FAILED',
        error.message,
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

        // Update or create match details with toss information
        const matchDetails = await this.matchDetailsModel.findOneAndUpdate(
          { matchId: matchObjectId },
          {
            toss: {
              tossText: updateTossDto.tossText,
              winnerId: winnerObjectId,
              elected: updateTossDto.elected,
              tossTime: new Date(),
            },
          },
          { new: true, upsert: true, session }
        )
          .populate('toss.winnerId', 'name shortName code logo')
          .lean();

        return this.responseService.successWithSingle(
          matchDetails,
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
      if (updateDto.captainId && Types.ObjectId.isValid(updateDto.captainId)) {
        updateData.captainId = new Types.ObjectId(updateDto.captainId);
      }
      if (updateDto.viceCaptainId && Types.ObjectId.isValid(updateDto.viceCaptainId)) {
        updateData.viceCaptainId = new Types.ObjectId(updateDto.viceCaptainId);
      }
      if (updateDto.wicketKeeperId && Types.ObjectId.isValid(updateDto.wicketKeeperId)) {
        updateData.wicketKeeperId = new Types.ObjectId(updateDto.wicketKeeperId);
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

      // Get or create inning
      let inning = await this.inningModel
        .findOne({ matchId: matchObjectId, inningNumber })
        .populate('battingTeamId', 'name shortName code logo')
        .populate('bowlingTeamId', 'name shortName code logo')
        .lean();

      if (!inning) {
        let battingTeamId: Types.ObjectId | undefined;
        let bowlingTeamId: Types.ObjectId | undefined;

        // Try to get teams from previous inning
        if (inningNumber > 1) {
          const previousInning = await this.inningModel
            .findOne({ matchId: matchObjectId, inningNumber: inningNumber - 1 })
            .lean();

          if (previousInning) {
            battingTeamId = previousInning.bowlingTeamId as any;
            bowlingTeamId = previousInning.battingTeamId as any;
          }
        }

        // Fallback to live status
        if (!battingTeamId) {
          const liveStatus = await this.liveMatchStatusModel
            .findOne({ matchId: matchObjectId })
            .lean();

          if (liveStatus?.battingTeamId) {
            // If we're creating a higher inning number than what's live, swap
            if (inningNumber > liveStatus.currentInning) {
              battingTeamId = liveStatus.bowlingTeamId;
              bowlingTeamId = liveStatus.battingTeamId;
            } else {
              battingTeamId = liveStatus.battingTeamId;
              bowlingTeamId = liveStatus.bowlingTeamId;
            }
          }
        }

        // Final fallback to match teams
        if (!battingTeamId) {
          battingTeamId = match.teamAId;
          bowlingTeamId = match.teamBId;
        }

        // Create default inning
        const newInning = await this.inningModel.create({
          matchId: matchObjectId,
          inningNumber,
          battingTeamId,
          bowlingTeamId,
          totalRuns: 0,
          totalWickets: 0,
          totalOvers: 0,
        });

        // Also update LiveMatchStatus if this is now the current inning
        await this.liveMatchStatusModel.findOneAndUpdate(
          { matchId: matchObjectId },
          {
            currentInning: inningNumber,
            battingTeamId,
            bowlingTeamId,
            score: "0/0",
            overs: "0.0",
            balls: 0,
            currentOver: 0,
            currentBall: 0,
            lastUpdated: new Date(),
          },
          { upsert: true }
        );

        // Populate the created inning
        inning = await this.inningModel
          .findById(newInning._id)
          .populate('battingTeamId', 'name shortName code logo')
          .populate('bowlingTeamId', 'name shortName code logo')
          .lean();
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

        // Also update LiveMatchStatus if this is the current inning
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

        // Sync inning teams with live status if mismatched (fixes stale data issues)
        if (inning) {
          const liveStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).session(session).lean();
          if (liveStatus && liveStatus.battingTeamId && liveStatus.bowlingTeamId) {
            const battingTeam = liveStatus.battingTeamId as any;
            const lsBattingId = battingTeam._id ? battingTeam._id.toString() : battingTeam.toString();

            const bowlingTeam = liveStatus.bowlingTeamId as any;
            const lsBowlingId = bowlingTeam._id ? bowlingTeam._id.toString() : bowlingTeam.toString();

            const inningBattingId = inning.battingTeamId?.toString();
            const inningBowlingId = inning.bowlingTeamId?.toString();

            if (lsBattingId !== inningBattingId || lsBowlingId !== inningBowlingId) {
              // Update inning to match live status
              inning = await this.inningModel.findOneAndUpdate(
                { _id: inning._id },
                {
                  battingTeamId: new Types.ObjectId(lsBattingId),
                  bowlingTeamId: new Types.ObjectId(lsBowlingId)
                },
                { new: true, session }
              );
            }
          }
        }

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

          // Try to get batting/bowling teams from live status first
          const liveStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).session(session).lean();
          let battingTeamId: Types.ObjectId | null = null;
          let bowlingTeamId: Types.ObjectId | null = null;

          if (liveStatus?.battingTeamId && liveStatus?.bowlingTeamId) {
            battingTeamId = typeof liveStatus.battingTeamId === 'object'
              ? liveStatus.battingTeamId._id
              : new Types.ObjectId(liveStatus.battingTeamId);
            bowlingTeamId = typeof liveStatus.bowlingTeamId === 'object'
              ? liveStatus.bowlingTeamId._id
              : new Types.ObjectId(liveStatus.bowlingTeamId);
          } else {
            // Don't auto-assign teams - require them to be set in live status first
            return this.responseService.error(
              'Batting and bowling teams not set',
              'TEAMS_NOT_SET',
              'Please set batting and bowling teams in live status before initializing scorecards. Teams should be set based on toss result or match situation.',
              undefined,
              null,
              HttpStatus.BAD_REQUEST,
            );
          }

          // Validate that teams are properly set
          if (!battingTeamId || !bowlingTeamId) {
            return this.responseService.error(
              'Invalid team configuration',
              'INVALID_TEAMS',
              'Batting and bowling teams must be set before initializing scorecards',
              undefined,
              null,
              HttpStatus.BAD_REQUEST,
            );
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
    // Update LiveMatchStatus
    await this.liveMatchStatusModel.findOneAndUpdate(
      { matchId },
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

      // Find current striker and non-striker - use LiveMatchStatus IDs first for accuracy
      const liveStatus = await this.liveMatchStatusModel.findOne({ matchId: matchObjectId }).exec();

      let striker = null;
      let nonStriker = null;

      // Try using IDs from LiveMatchStatus first (most reliable)
      if (liveStatus?.currentStrikerId) {
        striker = await this.battingScorecardModel.findOne({
          matchId: matchObjectId,
          inningId: inning._id,
          playerId: liveStatus.currentStrikerId,
          isOut: false,
        }).exec();
      }

      if (liveStatus?.currentNonStrikerId) {
        nonStriker = await this.battingScorecardModel.findOne({
          matchId: matchObjectId,
          inningId: inning._id,
          playerId: liveStatus.currentNonStrikerId,
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

      // Update LiveMatchStatus with currentBowlerId
      const liveStatus = await this.liveMatchStatusModel.findOneAndUpdate(
        { matchId: matchObjectId },
        { $set: { currentBowlerId: playerObjectId } },
        { new: true },
      ).exec();

      return this.responseService.successWithSingle(
        { bowler, liveStatus },
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


}

