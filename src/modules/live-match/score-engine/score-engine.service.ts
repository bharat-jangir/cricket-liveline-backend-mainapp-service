import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { BallEvent } from './interfaces/ball-event.interface';
import { MatchState } from './interfaces/match-state.interface';
import { ScoreHistory, ScoreHistoryDocument } from '../../../entities/score-history.entity';
import { LiveMatchStatus, LiveMatchStatusDocument } from '../../../entities/live-match-status.entity';
import { Match, MatchDocument } from '../../../entities/match.entity';
import { Inning, InningDocument } from '../../../entities/inning.entity';
import { BattingScorecard, BattingScorecardDocument } from '../../../entities/batting-scorecard.entity';
import { BowlingScorecard, BowlingScorecardDocument } from '../../../entities/bowling-scorecard.entity';
import { OverSummary, OverSummaryDocument } from '../../../entities/over-summary.entity';

@Injectable()
export class ScoreEngineService {
    private readonly logger = new Logger(ScoreEngineService.name);

    constructor(
        @InjectModel(ScoreHistory.name) private scoreHistoryModel: Model<ScoreHistoryDocument>,
        @InjectModel(LiveMatchStatus.name) private liveStatusModel: Model<LiveMatchStatusDocument>,
        @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
        @InjectModel(Inning.name) private inningModel: Model<InningDocument>,
        @InjectModel(BattingScorecard.name) private battingModel: Model<BattingScorecardDocument>,
        @InjectModel(BowlingScorecard.name) private bowlingModel: Model<BowlingScorecardDocument>,
        @InjectModel(OverSummary.name) private overSummaryModel: Model<OverSummaryDocument>,
    ) { }

    /**
     * Main entry point for processing a ball or wicket
     */
    async handleEvent(matchId: string, event: BallEvent): Promise<any> {
        try {
            const matchObjectId = this.validateAndConvertId(matchId);
            const currentState = await this.loadState(matchObjectId);

            if (event.type === 'UNDO') {
                return await this.processUndo(matchId);
            }

            // Save snapshot of current state before applying changes
            await this.saveSnapshot(matchId, currentState, event);

            let newState = currentState;
            switch (event.type) {
                case 'RUN':
                case 'WIDE':
                case 'NO_BALL':
                case 'BYE':
                case 'LEG_BYE':
                    newState = await this.processBall(currentState, event);
                    break;
                case 'WICKET':
                    newState = await this.processWicket(currentState, event);
                    break;
                case 'OVER_END':
                    newState = await this.endOver(currentState);
                    break;
                default:
                    // Handle unknown events (rain delay, messages, etc.)
                    newState = await this.processMessage(currentState, event);
                    break;
            }

            await this.persistState(newState, event);
            return newState.liveStatus;

        } catch (error) {
            this.logger.error(`ScoreEngine Error: ${error.message}`);
            if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException(error.message || 'Internal Scoring Engine Error');
        }
    }

    private validateAndConvertId(id: string): Types.ObjectId {
        if (!id || !isValidObjectId(id)) {
            throw new BadRequestException(`Invalid ID provided: ${id}. Must be a 24-character hex string.`);
        }
        return new Types.ObjectId(id);
    }

    private async loadState(matchId: Types.ObjectId): Promise<MatchState> {
        const liveStatus = await this.liveStatusModel.findOne({ matchId }).exec();
        if (!liveStatus) throw new NotFoundException('Match Live Status not found');

        const inning = await this.inningModel.findOne({ 
            matchId, 
            inningNumber: liveStatus.currentInning 
        }).exec();
        if (!inning) throw new NotFoundException('Active Inning not found');

        // Get current players from BattingScorecard and BowlingScorecard using LiveMatchStatus IDs
        const [striker, nonStriker, bowler] = await Promise.all([
            liveStatus.currentStrikerId ? this.battingModel.findOne({ matchId, inningId: inning._id, playerId: liveStatus.currentStrikerId }).exec() : null,
            liveStatus.currentNonStrikerId ? this.battingModel.findOne({ matchId, inningId: inning._id, playerId: liveStatus.currentNonStrikerId }).exec() : null,
            liveStatus.currentBowlerId ? this.bowlingModel.findOne({ matchId, inningId: inning._id, playerId: liveStatus.currentBowlerId }).exec() : null
        ]);

        return {
            liveStatus,
            inning,
            striker: striker as any,
            nonStriker: nonStriker as any,
            bowler: bowler as any,
            currentOverBalls: []
        };
    }

    private async processBall(state: MatchState, event: BallEvent): Promise<MatchState> {
        const { inning, striker, nonStriker, bowler } = state;
        const runsScored = event.runs || 0;
        const extras = event.extras || 0;
        
        const isWide = event.type === 'WIDE';
        const isNoBall = event.type === 'NO_BALL';
        const isBye = event.type === 'BYE';
        const isLegBye = event.type === 'LEG_BYE';
        const isLegalBall = !isWide && !isNoBall;

        // 1. Inning Updates
        inning.totalRuns += (runsScored + extras);
        if (isLegalBall) inning.totalBalls += 1;
        if (isWide) inning.wides += (extras || 1);
        if (isNoBall) inning.noBalls += (extras || 1);
        if (isBye) inning.byes += runsScored;
        if (isLegBye) inning.legByes += runsScored;
        inning.extras += extras;

        // 2. Update striker stats in BattingScorecard
        if (striker && !isWide) {
            if (!isBye && !isLegBye) {
                striker.runs += runsScored;
                if (runsScored === 4) striker.fours += 1;
                if (runsScored === 6) striker.sixes += 1;
            }
            if (isLegalBall || isNoBall) {
                striker.balls += 1;
                striker.strikeRate = striker.balls > 0 ? (striker.runs / striker.balls) * 100 : 0;
            }
        } else if (!striker && state.liveStatus.currentStrikerId && !isWide) {
            // Create striker if doesn't exist
            const newStriker = await this.battingModel.create({
                matchId: inning.matchId,
                inningId: inning._id,
                playerId: state.liveStatus.currentStrikerId,
                battingPosition: 1,
                runs: !isBye && !isLegBye ? runsScored : 0,
                balls: isLegalBall || isNoBall ? 1 : 0,
                fours: runsScored === 4 ? 1 : 0,
                sixes: runsScored === 6 ? 1 : 0
            });
            state.striker = newStriker as any;
        }

        // 3. Update bowler stats in BowlingScorecard
        if (bowler) {
            if (isLegalBall) {
                bowler.balls = (bowler.balls || 0) + 1;
                const completedOvers = Math.floor(bowler.balls / 6);
                const remainingBalls = bowler.balls % 6;
                bowler.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
            }
            if (!isBye && !isLegBye) {
                bowler.runs += (runsScored + extras);
            }
            if (bowler.overs > 0) {
                bowler.economy = bowler.runs / bowler.overs;
            }
        } else if (!bowler && state.liveStatus.currentBowlerId) {
            // Create bowler if doesn't exist
            const newBowler = await this.bowlingModel.create({
                matchId: inning.matchId,
                inningId: inning._id,
                playerId: state.liveStatus.currentBowlerId,
                bowlingOrder: 1,
                balls: isLegalBall ? 1 : 0,
                runs: !isBye && !isLegBye ? (runsScored + extras) : 0,
                overs: isLegalBall ? 0.1 : 0
            });
            state.bowler = newBowler as any;
        }

        // 4. Strike Rotation - only for non-wide balls where batsmen actually run
        if (!isWide && runsScored % 2 !== 0) {
            this.swapStrike(state);
        }

        this.recordBallData(state, event, false);
        return state;
    }

    private async processWicket(state: MatchState, event: BallEvent): Promise<MatchState> {
        const { inning, striker, bowler } = state;

        const isWide = event.type === 'WIDE';
        const isNoBall = event.type === 'NO_BALL';
        const isLegalBall = !isWide && !isNoBall;

        if (striker) {
            // Only count balls for legal deliveries and no-balls (not wides)
            if (isLegalBall || isNoBall) {
                striker.balls += 1;
                striker.strikeRate = striker.balls > 0 ? (striker.runs / striker.balls) * 100 : 0;
            }
            
            // Mark player as out
            striker.isOut = true;
            striker.dismissalType = event.wicketType || 'bowled';
            striker.bowlerId = bowler?.playerId;
            striker.teamId = inning.battingTeamId;

            inning.totalWickets += 1;
            if (isLegalBall) {
                inning.totalBalls += 1;
            }

            // Update lastWicket in inning
            inning.lastWicket = {
                name: `Player ${striker.playerId}`,
                dismissal: event.wicketType || 'bowled',
                runs: striker.runs,
                balls: striker.balls,
                fours: striker.fours,
                sixes: striker.sixes,
                to: `Bowler ${bowler?.playerId}`,
                tr: `${striker.runs}(${striker.balls})`,
                playerId: striker.playerId
            };

            if (bowler) {
                if (isLegalBall || isNoBall) {
                    bowler.balls = (bowler.balls || 0) + 1;
                    const completedOvers = Math.floor(bowler.balls / 6);
                    const remainingBalls = bowler.balls % 6;
                    bowler.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
                }
                bowler.wickets += 1;
                if (bowler.overs > 0) {
                    bowler.economy = bowler.runs / bowler.overs;
                }
                bowler.teamId = inning.bowlingTeamId;
            }

            this.recordBallData(state, event, true);
        }
        return state;
    }

    private swapStrike(state: MatchState) {
        if (state.striker && state.nonStriker) {
            const temp = state.striker;
            state.striker = state.nonStriker;
            state.nonStriker = temp;
            
            // Update both players' isOnStrike flags
            state.striker.isOnStrike = true;
            state.nonStriker.isOnStrike = false;
            
            // Update LiveMatchStatus IDs
            if (state.liveStatus) {
                state.liveStatus.currentStrikerId = state.striker.playerId;
                state.liveStatus.currentNonStrikerId = state.nonStriker.playerId;
            }
        }
    }

    private recordBallData(state: MatchState, event: BallEvent, isWicket: boolean) {
        state.currentOverBalls.push({
            ballNumber: state.inning.totalBalls,
            runs: event.runs || 0,
            extras: event.extras || 0,
            isWide: event.type === 'WIDE',
            isNoBall: event.type === 'NO_BALL',
            isWicket,
            wicketType: event.wicketType,
            bowlerId: state.bowler?._id,
            strikerId: state.striker?._id,
            type: event.type
        });
    }

    private async endOver(state: MatchState): Promise<MatchState> {
        // Change strike at end of over
        this.swapStrike(state);
        return state;
    }

    private async processMessage(state: MatchState, event: BallEvent): Promise<MatchState> {
        // For non-cricket events, don't change any cricket statistics
        // currentBall will be set in persistState
        return state;
    }

    private async saveSnapshot(matchId: string, state: MatchState, event: BallEvent) {
        await this.scoreHistoryModel.create({
            matchId: new Types.ObjectId(matchId),
            inningId: state.inning._id,
            ballNumber: state.inning.totalBalls,
            event,
            stateSnapshot: JSON.parse(JSON.stringify(state)) // Deep copy
        });
    }

    private async processUndo(matchId: string): Promise<any> {
        const lastHistory = await this.scoreHistoryModel.findOne({ matchId: new Types.ObjectId(matchId) }).sort({ createdAt: -1 });
        if (!lastHistory) throw new BadRequestException('No history found to undo');

        const snapshot = lastHistory.stateSnapshot as any;

        await Promise.all([
            this.liveStatusModel.findByIdAndUpdate(snapshot.liveStatus._id, snapshot.liveStatus),
            this.inningModel.findByIdAndUpdate(snapshot.inning._id, snapshot.inning),
            snapshot.striker && this.battingModel.findByIdAndUpdate(snapshot.striker._id, snapshot.striker),
            snapshot.nonStriker && this.battingModel.findByIdAndUpdate(snapshot.nonStriker._id, snapshot.nonStriker),
            snapshot.bowler && this.bowlingModel.findByIdAndUpdate(snapshot.bowler._id, snapshot.bowler),
            this.scoreHistoryModel.findByIdAndDelete(lastHistory._id)
        ]);

        return snapshot.liveStatus;
    }

    private async persistState(state: MatchState, event?: BallEvent) {
        const { liveStatus, inning } = state;

        // Update over summary for each ball immediately
        if (state.currentOverBalls.length > 0) {
            await this.updateOverSummary(state);
        }

        // Update LiveMatchStatus
        if (liveStatus) {
            const currentOver = Math.floor(inning.totalBalls / 6);
            const currentBall = inning.totalBalls % 6;
            
            liveStatus.overs = `${currentOver}.${currentBall}`;
            liveStatus.score = `${inning.totalRuns}/${inning.totalWickets}`;
            liveStatus.balls = inning.totalBalls;
            liveStatus.currentOver = currentOver;
            
            // Always set currentBall to the original event string that was sent
            if (event) {
                liveStatus.currentBall = (event as any).originalEvent || event.type;
            }
            
            if (inning.lastWicket) {
                liveStatus.lastWicket = inning.lastWicket;
            }
            
            await liveStatus.save();
        }

        // Save inning
        await inning.save();

        // Save individual scorecards if they exist
        if (state.striker) await state.striker.save();
        if (state.nonStriker) await state.nonStriker.save();
        if (state.bowler) await state.bowler.save();
    }

    private async updateOverSummary(state: MatchState) {
        if (!state.bowler) return;
        
        const currentOver = Math.ceil(state.inning.totalBalls / 6);
        
        // Get ball representation
        const lastBall = state.currentOverBalls[state.currentOverBalls.length - 1];
        let ballValue = lastBall.runs.toString();
        if (lastBall.isWicket) ballValue = 'W';
        if (lastBall.isWide) ballValue = 'wd';
        if (lastBall.isNoBall) ballValue = 'nb';
        if (lastBall.type === 'BYE') ballValue = 'b';
        if (lastBall.type === 'LEG_BYE') ballValue = 'lb';

        // Find existing over summary or create new one
        let overSummary = await this.overSummaryModel.findOne({
            matchId: state.inning.matchId,
            inningId: state.inning._id,
            overNumber: currentOver
        });

        if (!overSummary) {
            overSummary = await this.overSummaryModel.create({
                matchId: state.inning.matchId,
                inningId: state.inning._id,
                overNumber: currentOver,
                bowlerId: state.bowler._id,
                runs: 0,
                wickets: 0,
                extras: 0,
                ballsData: [],
                isMaiden: false
            });
        }

        // Add ball to ballsData and recalculate totals
        overSummary.ballsData.push(ballValue);
        
        // Recalculate totals from all balls in this over
        overSummary.runs = 0;
        overSummary.wickets = 0;
        overSummary.extras = 0;
        
        state.currentOverBalls.forEach(ball => {
            overSummary.runs += ball.runs + ball.extras;
            if (ball.isWicket) overSummary.wickets += 1;
            if (ball.extras > 0) overSummary.extras += ball.extras;
        });
        
        overSummary.isMaiden = overSummary.runs === 0 && overSummary.wickets === 0;
        await overSummary.save();
    }
}