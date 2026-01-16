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
import { RedisPublisherService, MatchUpdatePayload } from '../../../common/redis/redis-publisher.service';

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
        private redisPublisher: RedisPublisherService,
    ) { }

    /**
     * Main entry point for processing a ball or wicket
     */
    async handleEvent(matchId: string, event: BallEvent): Promise<any> {
        try {
            const matchObjectId = this.validateAndConvertId(matchId);
            const currentState = await this.loadState(matchObjectId);

            if (event.type === 'UNDO') {
                return await this.processUndo(matchId, event);
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
                case 'PENALTY':
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
            await this.publishMatchUpdate(matchId, newState, event);
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
        const isPenalty = event.type === 'PENALTY';
        const isLegalBall = !isWide && !isNoBall && !isPenalty;

        // 1. Inning Updates
        inning.totalRuns += (runsScored + extras);
        if (isLegalBall) inning.totalBalls += 1;
        if (isWide) inning.wides += (extras || 1);
        if (isNoBall) inning.noBalls += (extras || 1);
        if (isBye) inning.byes += runsScored;
        if (isLegBye) inning.legByes += runsScored;
        if (isPenalty) inning.penalties += extras;
        inning.extras += extras;

        // 2. Update striker stats in BattingScorecard
        if (striker && !isWide && !isPenalty) {
            if (!isBye && !isLegBye) {
                striker.runs += runsScored;
                if (runsScored === 4) striker.fours += 1;
                if (runsScored === 6) striker.sixes += 1;
            }
            if (isLegalBall || isNoBall) {
                striker.balls += 1;
                striker.strikeRate = striker.balls > 0 ? (striker.runs / striker.balls) * 100 : 0;
            }
        } else if (!striker && state.liveStatus.currentStrikerId && !isWide && !isPenalty) {
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
            const bowlerRunsInBall = (!isBye && !isLegBye && !isPenalty) ? (runsScored + extras) : 0;
            if (bowlerRunsInBall === 0) {
                bowler.dots = (bowler.dots || 0) + 1;
            }
            if (!isBye && !isLegBye && !isPenalty) {
                bowler.runs += bowlerRunsInBall;
                if (runsScored === 4) bowler.fours = (bowler.fours || 0) + 1;
                if (runsScored === 6) bowler.sixes = (bowler.sixes || 0) + 1;
            }
            if (bowler.overs > 0) {
                bowler.economy = bowler.runs / bowler.overs;
            }
            if (bowler.wickets > 0) {
                bowler.average = bowler.runs / bowler.wickets;
                bowler.strikeRate = bowler.balls / bowler.wickets;
            } else {
                bowler.average = 0;
                bowler.strikeRate = 0;
            }
        } else if (!bowler && state.liveStatus.currentBowlerId) {
            // Create bowler if doesn't exist
            const bowlerRunsInBall = !isBye && !isLegBye && !isPenalty ? (runsScored + extras) : 0;
            const newBowler = await this.bowlingModel.create({
                matchId: inning.matchId,
                inningId: inning._id,
                playerId: state.liveStatus.currentBowlerId,
                bowlingOrder: 1,
                balls: isLegalBall ? 1 : 0,
                runs: bowlerRunsInBall,
                dots: bowlerRunsInBall === 0 ? 1 : 0,
                fours: runsScored === 4 && (!isBye && !isLegBye && !isPenalty) ? 1 : 0,
                sixes: runsScored === 6 && (!isBye && !isLegBye && !isPenalty) ? 1 : 0,
                overs: isLegalBall ? 0.1 : 0,
                economy: isLegalBall ? bowlerRunsInBall / 0.1 : 0
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

    private async processUndo(matchId: string, event?: BallEvent): Promise<any> {
        const lastHistory = await this.scoreHistoryModel.findOne({ matchId: new Types.ObjectId(matchId) }).sort({ createdAt: -1 });
        if (!lastHistory) throw new BadRequestException('No history found to undo');

        const lastEvent = lastHistory.event;
        const currentState = await this.loadState(new Types.ObjectId(matchId));

        // Validate undo is possible
        this.validateUndoOperation(currentState, lastEvent);

        // Reverse the last ball based on event type
        await this.reverseBallEvent(currentState, lastEvent);

        // Save the reversed state with the undo event for confirmation (sets currentBall in DB)
        await this.persistState(currentState, event);
        await this.publishMatchReset(matchId, currentState);

        // Delete the history entry
        await this.scoreHistoryModel.findByIdAndDelete(lastHistory._id);

        return currentState.liveStatus;
    }

    private validateUndoOperation(state: MatchState, event: BallEvent): void {
        // Prevent negative values
        const runsScored = event.runs || 0;
        const extras = event.extras || 0;

        if (state.inning.totalRuns < (runsScored + extras)) {
            throw new BadRequestException('Cannot undo: Would result in negative total runs');
        }

        if (event.type === 'WICKET' && state.inning.totalWickets <= 0) {
            throw new BadRequestException('Cannot undo: No wickets to reverse');
        }

        if (event.type === 'WIDE' && state.inning.wides < (extras || 1)) {
            throw new BadRequestException('Cannot undo: Insufficient wides to reverse');
        }

        if (event.type === 'NO_BALL' && state.inning.noBalls < (extras || 1)) {
            throw new BadRequestException('Cannot undo: Insufficient no-balls to reverse');
        }

        const isLegalBall = event.type !== 'WIDE' && event.type !== 'NO_BALL' && event.type !== 'PENALTY';
        if (isLegalBall && state.inning.totalBalls <= 0) {
            throw new BadRequestException('Cannot undo: No balls to reverse');
        }
    }

    private async reverseBallEvent(state: MatchState, event: BallEvent): Promise<void> {
        const { inning, striker, nonStriker, bowler } = state;
        const runsScored = event.runs || 0;
        const extras = event.extras || 0;

        const isWide = event.type === 'WIDE';
        const isNoBall = event.type === 'NO_BALL';
        const isBye = event.type === 'BYE';
        const isLegBye = event.type === 'LEG_BYE';
        const isPenalty = event.type === 'PENALTY';
        const isLegalBall = !isWide && !isNoBall && !isPenalty;
        const isWicket = event.type === 'WICKET';
        const isOverEnd = event.type === 'OVER_END';

        // Handle OVER_END separately
        if (isOverEnd) {
            this.swapStrike(state); // Reverse strike swap
            return;
        }

        // 1. Reverse Inning Updates
        inning.totalRuns = Math.max(0, inning.totalRuns - (runsScored + extras));
        if (isLegalBall) inning.totalBalls = Math.max(0, inning.totalBalls - 1);
        if (isWide) inning.wides = Math.max(0, inning.wides - (extras || 1));
        if (isNoBall) inning.noBalls = Math.max(0, inning.noBalls - (extras || 1));
        if (isBye) inning.byes = Math.max(0, inning.byes - runsScored);
        if (isLegBye) inning.legByes = Math.max(0, inning.legByes - runsScored);
        if (isPenalty) inning.penalties = Math.max(0, inning.penalties - extras);
        inning.extras = Math.max(0, inning.extras - extras);
        if (isWicket) {
            inning.totalWickets = Math.max(0, inning.totalWickets - 1);
            // Clear last wicket if this was the last wicket
            if (inning.totalWickets === 0) {
                inning.lastWicket = null;
            }
        }

        // 2. Reverse Strike Rotation (BEFORE updating striker stats)
        // This ensures the correct striker is selected for stat reversal if they rotated on an odd run
        if (!isWide && !isWicket && runsScored % 2 !== 0) {
            this.swapStrike(state);
        }

        // 3. Reverse Striker Updates
        if (state.striker && !isWide && !isPenalty) {
            const striker = state.striker;
            if (!isBye && !isLegBye && !isWicket) {
                striker.runs = Math.max(0, striker.runs - runsScored);
                if (runsScored === 4) striker.fours = Math.max(0, striker.fours - 1);
                if (runsScored === 6) striker.sixes = Math.max(0, striker.sixes - 1);
            }
            if (isLegalBall || isNoBall) {
                striker.balls = Math.max(0, striker.balls - 1);
                striker.strikeRate = striker.balls > 0 ? (striker.runs / striker.balls) * 100 : 0;
            }
            if (isWicket) {
                striker.isOut = false;
                striker.dismissalType = null;
                striker.bowlerId = null;
                striker.teamId = null;
            }
        }

        // 4. Reverse Bowler Updates
        if (bowler) {
            if (isLegalBall || (isNoBall && event.type === 'WICKET')) {
                bowler.balls = Math.max(0, bowler.balls - 1);
                const completedOvers = Math.floor(bowler.balls / 6);
                const remainingBalls = bowler.balls % 6;
                bowler.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
            }
            const bowlerRunsInBall = (!isBye && !isLegBye && !isPenalty) ? (runsScored + extras) : 0;
            if (bowlerRunsInBall === 0) {
                bowler.dots = Math.max(0, (bowler.dots || 0) - 1);
            }
            if (!isBye && !isLegBye && !isPenalty) {
                bowler.runs = Math.max(0, bowler.runs - bowlerRunsInBall);
                if (runsScored === 4) bowler.fours = Math.max(0, (bowler.fours || 0) - 1);
                if (runsScored === 6) bowler.sixes = Math.max(0, (bowler.sixes || 0) - 1);
            }
            if (isWicket) {
                bowler.wickets = Math.max(0, bowler.wickets - 1);
            }
            // Recalculate economy - handle division by zero
            if (bowler.overs > 0) {
                bowler.economy = bowler.runs / bowler.overs;
            } else {
                bowler.economy = 0;
            }

            if (bowler.wickets > 0) {
                bowler.average = bowler.runs / bowler.wickets;
                bowler.strikeRate = bowler.balls / bowler.wickets;
            } else {
                bowler.average = 0;
                bowler.strikeRate = 0;
            }

            // Check if we are undoing the end of a maiden over
            if (isLegalBall && (inning.totalBalls + 1) > 0 && (inning.totalBalls + 1) % 6 === 0) {
                const overNumber = Math.floor((inning.totalBalls + 1) / 6);
                const overSummary = await this.overSummaryModel.findOne({
                    matchId: inning.matchId,
                    inningId: inning._id,
                    overNumber: overNumber
                });
                if (overSummary && overSummary.isMaiden) {
                    bowler.maidens = Math.max(0, (bowler.maidens || 0) - 1);
                }
            }
        }

        // 5. Remove last ball from over summary
        await this.removeLastBallFromOverSummary(state);
    }

    private async removeLastBallFromOverSummary(state: MatchState): Promise<void> {
        if (!state.bowler) return;

        // Calculate which over the undone ball belonged to
        const ballsBeforeUndo = state.inning.totalBalls + 1;
        const overNumber = Math.ceil(ballsBeforeUndo / 6);

        const overSummary = await this.overSummaryModel.findOne({
            matchId: state.inning.matchId,
            inningId: state.inning._id,
            overNumber: overNumber
        });

        if (overSummary && overSummary.ballsData.length > 0) {
            // Remove last ball
            overSummary.ballsData.pop();

            // If no balls left, delete the over summary
            if (overSummary.ballsData.length === 0) {
                await this.overSummaryModel.findByIdAndDelete(overSummary._id);
            } else {
                // Recalculate over summary stats from remaining balls
                overSummary.runs = 0;
                overSummary.wickets = 0;
                overSummary.extras = 0;

                // Note: This is simplified. In production, you might want to
                // recalculate from the actual ball data or store more details
                overSummary.isMaiden = overSummary.runs === 0 && overSummary.wickets === 0;
                await overSummary.save();
            }
        }
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
            // For UNDO events, set it to 'confirming check' as requested
            if (event) {
                const eventVal = (event as any).originalEvent || event.type;
                liveStatus.currentBall = eventVal === 'UNDO' ? 'confirming' : eventVal;
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

        // Check for maiden over completion (6 legal balls)
        // Must do this BEFORE saving bowler so the maiden is persisted
        const isLegalBall = event && !['WIDE', 'NO_BALL', 'PENALTY', 'OVER_END', 'UNDO'].includes(event.type);
        if (isLegalBall && inning.totalBalls > 0 && inning.totalBalls % 6 === 0 && state.bowler) {
            const overNumber = Math.floor(inning.totalBalls / 6);
            const overSummary = await this.overSummaryModel.findOne({
                matchId: inning.matchId,
                inningId: inning._id,
                overNumber: overNumber
            });
            if (overSummary && overSummary.isMaiden) {
                state.bowler.maidens = (state.bowler.maidens || 0) + 1;
            }
        }

        if (state.bowler) await state.bowler.save();
    }

    private async updateOverSummary(state: MatchState) {
        if (!state.bowler) return;

        const { inning, bowler } = state;
        const lastBall = state.currentOverBalls[state.currentOverBalls.length - 1];
        if (!lastBall) return;

        const currentOver = Math.ceil(inning.totalBalls / 6) || 1;

        // Get ball representation
        let ballValue = lastBall.runs.toString();
        if (lastBall.isWicket) ballValue = 'W';
        if (lastBall.isWide) ballValue = (lastBall.runs > 0) ? `${lastBall.runs}wd` : 'wd';
        if (lastBall.isNoBall) ballValue = (lastBall.runs > 0) ? `${lastBall.runs}nb` : 'nb';
        if (lastBall.type === 'BYE') ballValue = lastBall.runs > 0 ? `b${lastBall.runs}` : 'b';
        if (lastBall.type === 'LEG_BYE') ballValue = lastBall.runs > 0 ? `lb${lastBall.runs}` : 'lb';
        if (lastBall.type === 'PENALTY') ballValue = `p${lastBall.extras}`;

        // Find existing over summary or create new one
        let overSummary = await this.overSummaryModel.findOne({
            matchId: inning.matchId,
            inningId: inning._id,
            overNumber: currentOver
        });

        if (!overSummary) {
            overSummary = await this.overSummaryModel.create({
                matchId: inning.matchId,
                inningId: inning._id,
                overNumber: currentOver,
                bowlerId: bowler._id,
                runs: 0,
                wickets: 0,
                extras: 0,
                ballsData: [],
                isMaiden: true // Start as true, will flip to false if runs conceded
            });
        }

        // Add ball to ballsData
        overSummary.ballsData.push(ballValue);

        // Update totals
        const runsScored = lastBall.runs || 0;
        const extras = lastBall.extras || 0;
        const totalRunsInBall = runsScored + extras;

        overSummary.runs += totalRunsInBall;
        if (lastBall.isWicket) overSummary.wickets += 1;
        if (extras > 0) overSummary.extras += extras;

        // Maiden check: Any runs conceded by bowler (Bat runs, Wides, No-balls)?
        // Byes, Leg-byes and Penalties don't break a maiden.
        const isBye = lastBall.type === 'BYE';
        const isLegBye = lastBall.type === 'LEG_BYE';
        const isPenalty = lastBall.type === 'PENALTY';

        const bowlerConcededRuns = (!isBye && !isLegBye && !isPenalty) ? totalRunsInBall : 0;

        if (bowlerConcededRuns > 0) {
            overSummary.isMaiden = false;
        }

        await overSummary.save();
    }

    private async publishMatchUpdate(matchId: string, state: MatchState, event: BallEvent): Promise<void> {
        const payload: MatchUpdatePayload = {
            matchId,
            type: event.type === 'WICKET' ? 'WICKET' : event.type === 'OVER_END' ? 'OVER_END' : 'BALL',
            timestamp: new Date(),
            inning: {
                number: state.inning.inningNumber,
                totalRuns: state.inning.totalRuns,
                totalBalls: state.inning.totalBalls,
                wickets: state.inning.totalWickets,
                overs: Math.floor(state.inning.totalBalls / 6) + (state.inning.totalBalls % 6) / 10,
                runRate: state.inning.totalBalls > 0 ? (state.inning.totalRuns / state.inning.totalBalls) * 6 : 0
            },
            striker: state.striker ? {
                playerId: state.striker.playerId.toString(),
                runs: state.striker.runs,
                balls: state.striker.balls,
                strikeRate: state.striker.strikeRate
            } : undefined,
            bowler: state.bowler ? {
                playerId: state.bowler.playerId.toString(),
                overs: state.bowler.overs,
                runs: state.bowler.runs,
                wickets: state.bowler.wickets,
                economy: state.bowler.economy
            } : undefined,
            lastBall: {
                runs: event.runs || 0,
                extras: event.extras || 0,
                isWicket: event.type === 'WICKET',
                ballType: event.type
            }
        };

        await this.redisPublisher.publishMatchUpdate(payload);
    }

    private async publishMatchReset(matchId: string, state: MatchState): Promise<void> {
        const payload: MatchUpdatePayload = {
            matchId,
            type: 'MATCH_RESET',
            timestamp: new Date(),
            inning: {
                number: state.inning.inningNumber,
                totalRuns: state.inning.totalRuns,
                totalBalls: state.inning.totalBalls,
                wickets: state.inning.totalWickets,
                overs: Math.floor(state.inning.totalBalls / 6) + (state.inning.totalBalls % 6) / 10,
                runRate: state.inning.totalBalls > 0 ? (state.inning.totalRuns / state.inning.totalBalls) * 6 : 0
            }
        };

        await this.redisPublisher.publishMatchUpdate(payload);
    }
}