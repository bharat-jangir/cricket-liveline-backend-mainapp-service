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

            // Check if this is a wicket trigger event (wdw, nbw)
            if ((event as any).triggerWicket) {
                // Process the wide/no-ball first, but don't process wicket yet
                await this.saveSnapshot(matchId, currentState, event);
                const newState = await this.processBall(currentState, event);
                await this.persistState(newState, event);
                await this.publishMatchUpdate(matchId, newState, event);

                // Return special response indicating wicket selection is needed
                return {
                    ...newState.liveStatus.toObject(),
                    requiresWicketSelection: true,
                    wicketContext: {
                        eventType: event.type,
                        runs: event.runs || 0,
                        extras: event.extras || 0
                    }
                };
            }

            // Define events that should be stored in history for Undo
            const isScoringEvent = ['RUN', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY', 'WICKET'].includes(event.type);

            // Save snapshot of current state before applying changes (only for scoring events)
            if (isScoringEvent) {
                await this.saveSnapshot(matchId, currentState, event);
            }

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
        const match = await this.matchModel.findById(matchId).exec();
        if (!match) throw new NotFoundException('Match not found');

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
            match,
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

        // Rules implementation based on provided screenshots
        if (isWide) {
            // Wide + Runs (wd1, wd4, etc.): All runs go to Wides extras
            inning.wides += (runsScored + extras);
        } else if (isNoBall) {
            // No Ball + Runs (Hit) vs No Ball + Byes
            if ((event as any).isExtraType) {
                // No Ball + Bye/Leg Bye: All to No Ball extras
                inning.noBalls += (runsScored + extras);
            } else {
                // No Ball + Hit: 1 to Extra, rest to Batter (already handled by totalRuns)
                inning.noBalls += extras; // usually 1
            }
        }

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
            const ballsPerOver = state.match.ballsPerOver || 6;
            if (isLegalBall) {
                bowler.balls = (bowler.balls || 0) + 1;
                const completedOvers = Math.floor(bowler.balls / ballsPerOver);
                const remainingBalls = bowler.balls % ballsPerOver;
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
        const isComposite = (event as any).isComposite;

        const isWide = event.type === 'WIDE';
        const isNoBall = event.type === 'NO_BALL';
        const isLegalBall = !isWide && !isNoBall;

        if (striker) {
            // Only count balls for legal deliveries and no-balls (not wides)
            // Skip ball increment if this is a composite event (already counted in previous trigger event)
            if (!isComposite && (isLegalBall || isNoBall)) {
                striker.balls += 1;
                striker.strikeRate = striker.balls > 0 ? (striker.runs / striker.balls) * 100 : 0;
            }

            // Mark player as out
            striker.isOut = true;
            striker.dismissalType = event.wicketType || 'bowled';
            striker.bowlerId = bowler?.playerId;
            striker.teamId = inning.battingTeamId;

            inning.totalWickets += 1;

            // Skip ball increment if composite (already counted)
            if (!isComposite && isLegalBall) {
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
                // Skip ball increment if composite (already counted)
                if (!isComposite && (isLegalBall || isNoBall)) {
                    bowler.balls = (bowler.balls || 0) + 1;
                    const completedOvers = Math.floor(bowler.balls / 6);
                    const remainingBalls = bowler.balls % 6;
                    bowler.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
                }

                // ICC Law Refinement: 
                // Rule: Wicket is only credited to the bowler if the batter is Stumped or Hit Wicket on a Wide.
                // Rule: On No Ball, bowler gets NO credit for any dismissal (ICC Law 21.18 excludes Hit Wicket).
                // Standard: Bowled, Caught, Stumped, LBW, Hit Wicket on a legal ball.
                const dt = (event.wicketType || 'bowled').toLowerCase();
                let bowlGetsCredit = false;

                if (isLegalBall) {
                    bowlGetsCredit = ['bowled', 'caught', 'stumped', 'lbw', 'hit_wicket'].includes(dt);
                } else if (isWide) {
                    bowlGetsCredit = ['stumped', 'hit_wicket'].includes(dt);
                } else if (isNoBall) {
                    // Batter cannot be out Hit Wicket on a No Ball. 
                    // Other dismissals on NB (Run Out, etc.) are not credited to bowler.
                    bowlGetsCredit = false;
                }

                if (bowlGetsCredit) {
                    bowler.wickets += 1;
                }

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
        // If it's a composite event (like wdw, nbw), merge with previous ball
        if ((event as any).isComposite && state.currentOverBalls.length > 0) {
            const lastBall = state.currentOverBalls[state.currentOverBalls.length - 1];
            // Merge wicket details into last ball
            lastBall.isWicket = isWicket;
            lastBall.wicketType = event.wicketType;
            // Don't change runs/extras as they were set by the trigger event
            return;
        }

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
            type: event.type,
            isExtraType: (event as any).isExtraType
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
        this.logger.log(`[UNDO] Starting undo for match ${matchId}`);
        // Sort by _id descending to get the absolute latest event
        const lastHistory = await this.scoreHistoryModel.findOne({
            matchId: new Types.ObjectId(matchId)
        }).sort({ _id: -1 });

        if (!lastHistory) {
            this.logger.warn(`[UNDO] No history found for match ${matchId}`);
            throw new BadRequestException('No history found to undo');
        }

        const lastEvent = lastHistory.event;
        const snapshot = lastHistory.stateSnapshot;
        this.logger.log(`[UNDO] Undoing event type: ${lastEvent.type}, isComposite: ${(lastEvent as any).isComposite}`);

        const currentState = await this.loadState(new Types.ObjectId(matchId));

        // CRITICAL BUG FIX: If we are undoing a WICKET, the striker might already be 'out' 
        // and thus not loaded by loadState (if loadState used isOut: false filters).
        // Even if loadState is robust, it's safer to ensure we have the documents 
        // that were active at the time of the event.
        if (snapshot.striker && (!currentState.striker || currentState.striker._id.toString() !== snapshot.striker._id.toString())) {
            this.logger.log(`[UNDO] Recovering striker from snapshot: ${snapshot.striker._id}`);
            currentState.striker = await this.battingModel.findById(snapshot.striker._id);
        }
        if (snapshot.nonStriker && (!currentState.nonStriker || currentState.nonStriker._id.toString() !== snapshot.nonStriker._id.toString())) {
            this.logger.log(`[UNDO] Recovering non-striker from snapshot: ${snapshot.nonStriker._id}`);
            currentState.nonStriker = await this.battingModel.findById(snapshot.nonStriker._id);
        }
        if (snapshot.bowler && (!currentState.bowler || currentState.bowler._id.toString() !== snapshot.bowler._id.toString())) {
            this.logger.log(`[UNDO] Recovering bowler from snapshot: ${snapshot.bowler._id}`);
            currentState.bowler = await this.bowlingModel.findById(snapshot.bowler._id);
        }

        // Restore liveStatus flags from the snapshot to ensure UI consistency (e.g. requiresWicketSelection)
        if (snapshot.liveStatus) {
            currentState.liveStatus.requiresWicketSelection = snapshot.liveStatus.requiresWicketSelection;
            currentState.liveStatus.wicketContext = snapshot.liveStatus.wicketContext;
        }

        // Validate undo is possible
        this.validateUndoOperation(currentState, lastEvent);

        // Reverse the last ball based on event type
        await this.reverseBallEvent(currentState, lastEvent);

        // Save the reversed state
        await this.persistState(currentState, event);
        await this.publishMatchReset(matchId, currentState);

        // Delete the history entry
        await this.scoreHistoryModel.findByIdAndDelete(lastHistory._id);
        this.logger.log(`[UNDO] Successfully undid ${lastEvent.type}. History deleted.`);

        // Atomic Undo: If the event we just undid was composite (part 2 of wdw),
        // we must also undo the trigger event (part 1 of wdw).
        if ((lastEvent as any).isComposite) {
            this.logger.log(`[UNDO] Event was composite, triggering recursive undo for part 1`);
            return await this.processUndo(matchId, event);
        }

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
        if (isLegalBall && !(event as any).isComposite) inning.totalBalls = Math.max(0, inning.totalBalls - 1);

        if (isWide) {
            inning.wides = Math.max(0, inning.wides - (runsScored + extras));
        } else if (isNoBall) {
            if ((event as any).isExtraType) {
                inning.noBalls = Math.max(0, inning.noBalls - (runsScored + extras));
            } else {
                inning.noBalls = Math.max(0, inning.noBalls - extras);
            }
        }

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
                striker.dismissalText = null;
                striker.bowlerId = null;
                striker.fielderId = null;
                striker.fielder2Id = null;
                striker.teamId = null;
            }
        }

        // 4. Reverse Bowler Updates
        if (bowler) {
            const isComposite = (event as any).isComposite;
            if ((isLegalBall || isNoBall) && !isComposite) {
                const ballsPerOver = state.match.ballsPerOver || 6;
                bowler.balls = Math.max(0, bowler.balls - 1);
                const completedOvers = Math.floor(bowler.balls / ballsPerOver);
                const remainingBalls = bowler.balls % ballsPerOver;
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
                // Rule-based credit reversal
                const dt = (event.wicketType || 'bowled').toLowerCase();
                let bowlHadCredit = false;

                if (isLegalBall) {
                    bowlHadCredit = ['bowled', 'caught', 'stumped', 'lbw', 'hit_wicket'].includes(dt);
                } else if (isWide) {
                    bowlHadCredit = ['stumped', 'hit_wicket'].includes(dt);
                } else if (isNoBall) {
                    bowlHadCredit = false;
                }

                if (bowlHadCredit) {
                    bowler.wickets = Math.max(0, bowler.wickets - 1);
                }
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
            const ballsPerOver = state.match.ballsPerOver || 6;
            if (isLegalBall && (inning.totalBalls + 1) > 0 && (inning.totalBalls + 1) % ballsPerOver === 0) {
                const overNumber = Math.floor((inning.totalBalls + 1) / ballsPerOver);
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

        // 5. Revert over summary (handle composite un-merge if needed)
        await this.revertOverSummaryEvent(state, event);
    }

    private async revertOverSummaryEvent(state: MatchState, event: BallEvent): Promise<void> {
        if (!state.bowler) return;

        // Calculate which over the undone ball belonged to
        // If it's a legal ball, totalBalls was just decremented, so we look at the ball that was just there?
        // Actually, for the summary, we want the current state's over perspective?
        // Undo happens AFTER state reversion.
        // If we undid a legal ball, totalBalls is now X. The ball was X+1.
        // If we undid a wide, totalBalls is X. The ball was "extra" in this over.

        // Actually, for the summary, we want the current state's over perspective?
        // Undo happens AFTER state reversion.
        // If we undid a legal ball, totalBalls is now X. The ball was X+1.
        // If we undid a wide, totalBalls is X. The ball was "extra" in this over.

        // Simpler: Just find the summary for the current over (or previous if empty? No).
        // Safest: Use the current over index from state.
        const ballsPerOver = state.match.ballsPerOver || 6;
        const currentOver = Math.floor(state.inning.totalBalls / ballsPerOver) + 1;
        // Wait, if we undid the last ball of over 5, totalBalls is now over 4's end.
        // But the summary we want to modify is over 5 (which might now be empty).

        // Let's use the event logic. 
        // If we undid an event that pushed a ball?
        // If composite, we modify the existing last ball.

        // We can just query for the latest over summary for this inning
        const overSummary = await this.overSummaryModel.findOne({
            matchId: state.inning.matchId,
            inningId: state.inning._id
        }).sort({ overNumber: -1 });

        if (!overSummary) return;

        const isComposite = (event as any).isComposite;
        const runs = event.runs || 0;
        const extras = event.extras || 0;
        const totalRuns = runs + extras;
        const isWicket = event.type === 'WICKET';
        const isExtra = extras > 0;

        if (overSummary.ballsData.length > 0) {
            if (isComposite) {
                // If composite, we merged into the last ball. So we un-merge.
                // Assuming we appended "+W" or similar.
                const lastBallStr = overSummary.ballsData[overSummary.ballsData.length - 1];
                // Simple reversion: remove "+W" or "W" if it was just appended
                // For now, let's just strip "W" from the end if it exists, or just leave it if it's complex.
                // Better: If we knew it was wd+W, and we undo W, we want wd.
                // Let's assume the update logic appended "+W".
                if (lastBallStr.endsWith('+W')) {
                    overSummary.ballsData[overSummary.ballsData.length - 1] = lastBallStr.slice(0, -2);
                } else if (lastBallStr.endsWith('W')) {
                    // Fallback, might not be accurate if it was just "W"
                    // But composite implies previous event existed.
                }
            } else {
                // Determine if the event being undone actually pushed a ball?
                // Event types that push balls: RUN, WIDE, NO_BALL, WICKET (non-composite), BYE, LEG_BYE
                // OVER_END doesn't push ball.
                if (event.type !== 'OVER_END') {
                    overSummary.ballsData.pop();
                }
            }

            // Revert Stats (Deltas)
            overSummary.runs = Math.max(0, overSummary.runs - totalRuns);
            overSummary.extras = Math.max(0, overSummary.extras - extras);
            if (isWicket) {
                overSummary.wickets = Math.max(0, overSummary.wickets - 1);
            }

            // Recalculate Maiden/Maiden Status?
            // If runs became 0 and wickets 0... hard to prove maiden without full replay.
            // But we can approximate or just leave it.
            // Correct approach: Sum runs from ballsData? strings don't have runs.
            // For now, let's assume if runs > 0 it's not maiden.
            overSummary.isMaiden = overSummary.runs === 0 && overSummary.wickets === 0; // Simplified

            // Cleanup empty summary?
            if (overSummary.ballsData.length === 0) {
                await this.overSummaryModel.findByIdAndDelete(overSummary._id);
            } else {
                await overSummary.save();
            }
        }
    }

    private async persistState(state: MatchState, event?: BallEvent) {
        const { liveStatus, inning } = state;

        // Update over summary for each ball immediately
        if (state.currentOverBalls.length > 0 && event && event.type !== 'UNDO') {
            await this.updateOverSummary(state, event);
        }

        // Update LiveMatchStatus
        if (liveStatus) {
            const ballsPerOver = state.match.ballsPerOver || 6;
            const currentOver = Math.floor(inning.totalBalls / ballsPerOver);
            const currentBall = inning.totalBalls % ballsPerOver;

            liveStatus.overs = `${currentOver}.${currentBall}`;
            liveStatus.score = `${inning.totalRuns}/${inning.totalWickets}`;
            liveStatus.balls = inning.totalBalls;
            liveStatus.currentOver = currentOver;

            // Sync match parameters to live status for frontend consumption
            liveStatus.ballsPerOver = ballsPerOver;
            liveStatus.oversPerInning = state.match.oversPerInning || 20;

            // Sync current player IDs from state documents
            if (state.striker) liveStatus.currentStrikerId = state.striker.playerId;
            if (state.nonStriker) liveStatus.currentNonStrikerId = state.nonStriker.playerId;
            if (state.bowler) liveStatus.currentBowlerId = state.bowler.playerId;

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

    private async updateOverSummary(state: MatchState, event: BallEvent) {
        if (!state.bowler) return;

        const { inning, bowler } = state;
        const lastBall = state.currentOverBalls[state.currentOverBalls.length - 1];
        if (!lastBall) return;

        const ballsPerOver = state.match.ballsPerOver || 6;
        const currentOver = Math.ceil(inning.totalBalls / ballsPerOver) || 1;
        const isComposite = (event as any).isComposite;

        // Get ball representation
        let ballValue = lastBall.runs.toString();
        if (lastBall.isWicket) ballValue = 'W';

        // Improved logic: combine wide/no-ball with run/wicket using + notation
        if (lastBall.isWide) {
            const extraRuns = lastBall.extras - 1;
            const suffix = lastBall.isExtraType === 'BYE' ? 'b' : lastBall.isExtraType === 'LEG_BYE' ? 'lb' : '';
            ballValue = (extraRuns > 0) ? `wd+${extraRuns}${suffix}` : 'wd';
            if (lastBall.isWicket) ballValue += '+W';
        } else if (lastBall.isNoBall) {
            if (lastBall.runs > 0) {
                ballValue = `nb+${lastBall.runs}`;
            } else if (lastBall.extras > 1) {
                const extraRuns = lastBall.extras - 1;
                const suffix = lastBall.isExtraType === 'BYE' ? 'b' : lastBall.isExtraType === 'LEG_BYE' ? 'lb' : '';
                ballValue = `nb+${extraRuns}${suffix}`;
            } else {
                ballValue = 'nb';
            }
            if (lastBall.isWicket) ballValue += '+W';
        } else if (lastBall.isWicket) {
            // Legal ball wicket
            // If runs were scored? e.g. "1+W" (Run Out)
            ballValue = lastBall.runs > 0 ? `${lastBall.runs}+W` : 'W';
        }

        if (lastBall.type === 'BYE') ballValue = lastBall.runs > 0 ? `${lastBall.runs}b` : 'b';
        if (lastBall.type === 'LEG_BYE') ballValue = lastBall.runs > 0 ? `${lastBall.runs}lb` : 'lb';
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
                isMaiden: true
            });
        }

        if (isComposite && overSummary.ballsData.length > 0) {
            console.log(`[DEBUG] Merging. Data before: ${JSON.stringify(overSummary.ballsData)}, eventType: ${event.type}`);
            // Merge logic: Append +W to the last ball string
            // We know the last ball was the 'wide' or 'no ball' trigger.
            let lastVal = overSummary.ballsData[overSummary.ballsData.length - 1];

            // Avoid double appending and only append for Wicket events
            if (event.type === 'WICKET' && !lastVal.includes('W')) {
                lastVal += '+W';
            }
            // Update the last entry
            overSummary.ballsData[overSummary.ballsData.length - 1] = lastVal;
            overSummary.markModified('ballsData');
        } else {
            console.log(`[DEBUG] Pushing new ball. isComposite: ${isComposite}, len: ${overSummary.ballsData.length}`);
            // Add ball to ballsData
            overSummary.ballsData.push(ballValue);
        }

        // Update totals
        // For composite events, we only add the delta from the event
        const eventRuns = event.runs || 0;
        const eventExtras = event.extras || 0;
        // Total runs in this event (for composite, the previous part already added its runs)
        const totalRunsInEvent = eventRuns + eventExtras;

        overSummary.runs += totalRunsInEvent;
        // Check if this specific event triggered a wicket
        if (event.type === 'WICKET') overSummary.wickets += 1;
        if (eventExtras > 0) overSummary.extras += eventExtras;

        // Maiden check
        const isBye = event.type === 'BYE';
        const isLegBye = event.type === 'LEG_BYE';
        const isPenalty = event.type === 'PENALTY';

        if (!isBye && !isLegBye && !isPenalty && totalRunsInEvent > 0) {
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