import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

    async handleEvent(matchId: string, event: BallEvent): Promise<any> {
        this.logger.log(`Handling event for match ${matchId}: ${event.type}`);

        // 1. Load Current State
        const currentState = await this.loadState(matchId);

        // 2. Save Snapshot for Undo (if not undoing)
        if (event.type !== 'UNDO') {
            await this.saveSnapshot(matchId, currentState, event);
        }

        // 3. Process Event
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
            case 'UNDO':
                return this.processUndo(matchId);
            case 'OVER_END':
                newState = await this.endOver(currentState);
                break;
            default:
                throw new BadRequestException('Invalid event type');
        }

        // 4. Save New State
        await this.persistState(newState);

        return newState.liveStatus;
    }

    private async loadState(matchId: string): Promise<MatchState> {
        const liveStatus = await this.liveStatusModel.findOne({ matchId }).exec();
        if (!liveStatus) throw new NotFoundException('Match Live Status not found');

        const inning = await this.inningModel.findOne({ matchId, inningNumber: liveStatus.currentInning }).exec();

        // Find current batters - prefer LiveMatchStatus IDs for faster lookup
        let striker = null;
        let nonStriker = null;

        if (liveStatus.currentStrikerId) {
            striker = await this.battingModel.findOne({
                matchId,
                inningId: inning._id,
                playerId: liveStatus.currentStrikerId,
                isOut: false,
            }).exec();
        }

        if (liveStatus.currentNonStrikerId) {
            nonStriker = await this.battingModel.findOne({
                matchId,
                inningId: inning._id,
                playerId: liveStatus.currentNonStrikerId,
                isOut: false,
            }).exec();
        }

        // Fallback: find by isOnStrike flag if IDs not set
        if (!striker) {
            striker = await this.battingModel.findOne({
                matchId,
                inningId: inning._id,
                isOut: false,
                isOnStrike: true
            }).exec();
        }

        if (!nonStriker) {
            nonStriker = await this.battingModel.findOne({
                matchId,
                inningId: inning._id,
                isOut: false,
                isOnStrike: false
            }).exec();
        }

        // Find current bowler using currentBowlerId from LiveStatus
        let bowler = null;
        if (liveStatus.currentBowlerId) {
            bowler = await this.bowlingModel.findOne({
                matchId,
                inningId: inning._id,
                playerId: liveStatus.currentBowlerId,
            }).exec();
        }
        
        // Fallback: find bowler with isCurrentBowler flag
        if (!bowler) {
            bowler = await this.bowlingModel.findOne({
                matchId,
                inningId: inning._id,
                isCurrentBowler: true,
            }).exec();
        }
        
        // Last fallback: find bowler with most overs
        if (!bowler) {
            const bowlers = await this.bowlingModel.find({
                matchId,
                inningId: inning._id,
            }).sort({ overs: -1, balls: -1 }).limit(1).exec();
            bowler = bowlers[0] || null;
        }

        return {
            liveStatus,
            inning,
            striker: striker as any,
            nonStriker: nonStriker as any,
            bowler: bowler as any,
            currentOverBalls: [] // Need to fetch from OverSummary
        };
    }


    private async processBall(state: MatchState, event: BallEvent): Promise<MatchState> {
        const { liveStatus, inning, striker, nonStriker, bowler } = state;

        let runsScored = event.runs || 0;
        let extras = event.extras || 0;
        let isWide = event.type === 'WIDE';
        let isNoBall = event.type === 'NO_BALL';
        let isBye = event.type === 'BYE';
        let isLegBye = event.type === 'LEG_BYE';
        let isDoNotCountBall = isWide || isNoBall; // Standard rule: W/NB don't count in over

        // 1. Update Inning Totals
        inning.totalRuns += runsScored + extras;
        // Wides and NoBalls trigger +1 extra automatically usually, but let's assume event.extras has the total extra cost
        // If event.type is WIDE and runs=0, extras should be at least 1.

        if (isWide) inning.wides += (extras || 1);
        if (isNoBall) inning.noBalls += (extras || 1);
        if (isBye) inning.byes += runsScored; // usually runs are passed as runsScored but allocated to byes
        if (isLegBye) inning.legByes += runsScored;
        inning.extras += extras;

        if (!isDoNotCountBall) {
            inning.totalBalls += 1;
            // Update Over Count (e.g. 0.1, 0.2)
            // Simplified: totalBalls / 6 gives overs. 
            // 8 balls = 1.2 overs
            const overs = Math.floor(inning.totalBalls / 6);
            const balls = inning.totalBalls % 6;
            inning.totalOvers = parseFloat(`${overs}.${balls}`);
        }

        // 2. Update Striker Stats
        if (striker && !isWide) {
            if (!isBye && !isLegBye) {
                striker.runs += runsScored;
                if (!isNoBall) striker.balls += 1; // NB doesn't count for bowler ball, but DOES it count for batsman? Usually YES.

                if (runsScored === 4) striker.fours += 1;
                if (runsScored === 6) striker.sixes += 1;
            } else {
                // Bye/LegBye: Batsman faces ball but gets no runs
                if (!isNoBall) striker.balls += 1;
            }
        }

        // 3. Update Bowler Stats
        if (bowler) {
            if (!isDoNotCountBall) {
                // Determine over decimals for bowler
                const currentBalls = (bowler.balls || 0) + 1;
                bowler.balls = currentBalls;
                bowler.overs = parseFloat(`${Math.floor(currentBalls / 6)}.${currentBalls % 6}`);
            }

            // Economy/Runs conceded
            // Bowler penalized for runs off bat, Wides, NoBalls. Not Byes/LegByes.
            let bowlerRuns = 0;
            if (isWide || isNoBall) bowlerRuns += extras;
            if (!isBye && !isLegBye) bowlerRuns += runsScored;

            bowler.runs += bowlerRuns;
        }

        // 4. Update Live Status Display
        liveStatus.score = `${inning.totalRuns}/${inning.totalWickets}`;
        liveStatus.overs = `${Math.floor(inning.totalBalls / 6)}.${inning.totalBalls % 6}`;
        liveStatus.balls = inning.totalBalls;

        // 5. Strike Rotation
        // Rotate if runs (bat + potential overthrows) is odd
        const totalRunsForRotation = runsScored + (isWide || isNoBall ? (extras - 1) : 0); // Logic can be complex
        // Simplified: generally if runs scored is odd, rotate.
        // Also if Bye/LegBye is odd, rotate.
        // If Wide + 1 run running -> Total 2, but crossed? 
        // Let's rely on event.runs being the total "completed runs" + boundaries

        const shouldRotate = (runsScored % 2 !== 0);

        if (shouldRotate && striker && nonStriker) {
            // Swap
            // Note: We just swap references in the object for next steps, 
            // but we must mark them as `isOnStrike` correctly in persistence
            striker.isOnStrike = false;
            nonStriker.isOnStrike = true;

            // Swap in state object for return
            state.striker = nonStriker;
            state.nonStriker = striker;
        }

        // 6. Record Ball in Over Summary (Memory / Doc)
        // We will push to `currentOverBalls` to be saved in OverSummary later
        state.currentOverBalls.push({
            ballNumber: event.ballNumber || inning.totalBalls, // Global ball
            runs: runsScored,
            extras: extras,
            isWide,
            isNoBall,
            isWicket: false, // Handled in processWicket
            bowlerId: bowler?._id,
            strikerId: striker?._id,
            type: event.type
        });

        // 7. Check Over End
        if (!isDoNotCountBall && inning.totalBalls % 6 === 0) {
            // End of over logic triggers automatically or via explicit event?
            // Usually valid ball 6 triggers end of over state.
            // We can return state with a flag "overEnded" or handle rotation here.

            // End of over rotation
            if (striker && nonStriker) {
                // Swap purely for over change
                const currentStriker = state.striker.isOnStrike ? state.striker : state.nonStriker;
                const currentNonStriker = state.striker.isOnStrike ? state.nonStriker : state.striker;

                currentStriker.isOnStrike = false;
                currentNonStriker.isOnStrike = true;

                // Update state refs
                state.striker = currentNonStriker;
                state.nonStriker = currentStriker;
            }

            // Mark bowler completed over?
            if (bowler) {
                bowler.completedOvers = (bowler.completedOvers || 0) + 1;
            }
        }

        return state;
    }

    private async processWicket(state: MatchState, event: BallEvent): Promise<MatchState> {
        const { liveStatus, inning, striker, bowler } = state;

        // 1. Mark current striker as Out
        if (striker) {
            striker.isOut = true;
            striker.dismissalType = event.wicketType || 'bowled';
            striker.bowlerId = bowler?._id;

            inning.totalWickets += 1;

            // Record in over summary
            state.currentOverBalls.push({
                ballNumber: event.ballNumber || inning.totalBalls + 1,
                runs: 0,
                extras: 0,
                isWide: false,
                isNoBall: false,
                isWicket: true,
                wicketType: event.wicketType,
                bowlerId: bowler?._id,
                strikerId: striker._id,
                type: 'WICKET'
            });

            // Increment balls for bowler/striker
            if (bowler) {
                bowler.balls = (bowler.balls || 0) + 1;
                bowler.wickets = (bowler.wickets || 0) + 1;
            }
            striker.balls = (striker.balls || 0) + 1; // Wicket ball counts as faced
            striker.isOnStrike = false; // Remove from strike

            // Note: A new batsman needs to be added manually via the UI
            // The system will find the next available batsman on the next ball
        }

        return state;
    }

    private async endOver(state: MatchState): Promise<MatchState> {
        // Logic for detailed over end if needed
        return state;
    }

    private async saveSnapshot(matchId: string, state: MatchState, event: BallEvent) {
        // Serialize state
        if (state.liveStatus && state.inning) {
            await this.scoreHistoryModel.create({
                matchId,
                inningId: state.inning._id,
                ballNumber: state.liveStatus.currentBall, // Approx
                event,
                stateSnapshot: state
            });
        }
    }

    private async processUndo(matchId: string): Promise<any> {
        // precise undo logic
        const lastHistory = await this.scoreHistoryModel.findOne({ matchId }).sort({ createdAt: -1 });
        if (!lastHistory) return null;

        // Restore state from snapshot
        // Delete history record
        await this.scoreHistoryModel.findByIdAndDelete(lastHistory._id);

        const snapshot = lastHistory.stateSnapshot as MatchState;

        // Restore each entity
        if (snapshot.liveStatus) await this.liveStatusModel.findByIdAndUpdate(snapshot.liveStatus._id, snapshot.liveStatus);
        if (snapshot.inning) await this.inningModel.findByIdAndUpdate(snapshot.inning._id, snapshot.inning);
        if (snapshot.striker) await this.battingModel.findByIdAndUpdate(snapshot.striker._id, snapshot.striker);
        if (snapshot.nonStriker) await this.battingModel.findByIdAndUpdate(snapshot.nonStriker._id, snapshot.nonStriker);
        if (snapshot.bowler) await this.bowlingModel.findByIdAndUpdate(snapshot.bowler._id, snapshot.bowler);

        return snapshot.liveStatus;
    }

    private async persistState(state: MatchState) {
        // Update LiveMatchStatus with current player IDs before saving
        if (state.liveStatus) {
            state.liveStatus.currentStrikerId = state.striker?.playerId || null;
            state.liveStatus.currentNonStrikerId = state.nonStriker?.playerId || null;
            state.liveStatus.currentBowlerId = state.bowler?.playerId || null;
            await state.liveStatus.save();
        }
        if (state.inning) await state.inning.save();
        if (state.striker) await state.striker.save();
        if (state.nonStriker) await state.nonStriker.save();
        if (state.bowler) await state.bowler.save();

        // Save OverSummary
        if (state.liveStatus && state.bowler) {
            const overNum = Math.floor((state.inning.totalBalls - 1) / 6) + 1; // 1-based over index
            await this.overSummaryModel.updateOne(
                {
                    matchId: state.liveStatus.matchId,
                    inningId: state.inning._id,
                    overNumber: overNum
                },
                {
                    $set: {
                        bowlerId: state.bowler._id,
                        // runs: 0, // Need to calc over total
                        // wickets: 0 // Need to calc over wicket
                    },
                    $push: {
                        ballsData: { $each: state.currentOverBalls }
                    }
                },
                { upsert: true }
            );
            // Clear temp buffer
            state.currentOverBalls = [];
        }
    }
}
