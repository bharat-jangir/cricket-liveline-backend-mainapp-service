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
                    throw new BadRequestException(`Unsupported event type: ${event.type}`);
            }

            await this.persistState(newState);
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

        // Fetch players based on IDs stored in LiveStatus
        const [striker, nonStriker, bowler] = await Promise.all([
            liveStatus.currentStrikerId ? this.battingModel.findOne({ matchId, inningId: inning._id, playerId: liveStatus.currentStrikerId, isOut: false }).populate('playerId', 'name').exec() : null,
            liveStatus.currentNonStrikerId ? this.battingModel.findOne({ matchId, inningId: inning._id, playerId: liveStatus.currentNonStrikerId, isOut: false }).populate('playerId', 'name').exec() : null,
            liveStatus.currentBowlerId ? this.bowlingModel.findOne({ matchId, inningId: inning._id, playerId: liveStatus.currentBowlerId }).populate('playerId', 'name').exec() : null
        ]);

        // Ensure BattingScorecard isOnStrike flags are synchronized with LiveMatchStatus IDs
        if (striker || nonStriker) {
            // First, set all batsmen in this inning to non-striker
            await this.battingModel.updateMany(
                { matchId, inningId: inning._id, isOut: false },
                { $set: { isOnStrike: false } }
            );
            
            // Then set the correct striker flag if striker exists
            if (striker) {
                await this.battingModel.updateOne(
                    { matchId, inningId: inning._id, playerId: striker.playerId },
                    { $set: { isOnStrike: true } }
                );
                striker.isOnStrike = true;
            }
            
            // Ensure non-striker flag is set correctly
            if (nonStriker) {
                nonStriker.isOnStrike = false;
            }
        }

        return {
            liveStatus,
            inning,
            striker: striker ? { ...striker.toObject(), playerName: (striker.playerId as any)?.name || 'Unknown' } as any : null,
            nonStriker: nonStriker ? { ...nonStriker.toObject(), playerName: (nonStriker.playerId as any)?.name || 'Unknown' } as any : null,
            bowler: bowler ? { ...bowler.toObject(), playerName: (bowler.playerId as any)?.name || 'Unknown' } as any : null,
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

        // 2. Batsman Updates
        if (striker && !isWide) {
            // Runs only count for batsman if not bye/legbye
            if (!isBye && !isLegBye) {
                striker.runs += runsScored;
                if (runsScored === 4) striker.fours += 1;
                if (runsScored === 6) striker.sixes += 1;
            }
            if (isLegalBall || isNoBall) striker.balls += 1;
        }

        // 3. Bowler Updates
        if (bowler) {
            if (isLegalBall) {
                bowler.balls = (bowler.balls || 0) + 1;
                const overs = Math.floor(bowler.balls / 6);
                const balls = bowler.balls % 6;
                bowler.overs = parseFloat(`${overs}.${balls}`);
            }
            // Bowler penalized for everything except Byes/LegByes
            if (!isBye && !isLegBye) {
                bowler.runs += (runsScored + extras);
            }
        }

        // 4. Strike Rotation
        // Rotate if runs off bat/byes/legbyes are odd
        if (runsScored % 2 !== 0) {
            this.swapStrike(state);
        }

        // 5. Over completion tracking (no automatic strike change)
        if (isLegalBall && inning.totalBalls % 6 === 0) {
            if (bowler) bowler.completedOvers = (bowler.completedOvers || 0) + 1;
        }

        this.recordBallData(state, event, false);
        return state;
    }

    private async processWicket(state: MatchState, event: BallEvent): Promise<MatchState> {
        const { inning, striker, bowler } = state;

        if (striker) {
            striker.isOut = true;
            striker.dismissalType = event.wicketType || 'bowled';
            striker.bowlerId = bowler?._id;
            striker.balls += 1;
            striker.isOnStrike = false;

            inning.totalWickets += 1;
            inning.totalBalls += 1;

            // Update lastWicket in inning
            inning.lastWicket = {
                name: (striker as any).playerName || 'Unknown',
                dismissal: event.wicketType || 'bowled',
                runs: striker.runs,
                balls: striker.balls,
                fours: striker.fours,
                sixes: striker.sixes,
                to: (bowler as any)?.playerName || 'Unknown',
                tr: `${striker.runs}(${striker.balls})`,
                playerId: striker.playerId
            };

            if (bowler) {
                bowler.balls += 1;
                bowler.wickets += 1;
                const overs = Math.floor(bowler.balls / 6);
                const balls = bowler.balls % 6;
                bowler.overs = parseFloat(`${overs}.${balls}`);
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
        const lastHistory = await this.scoreHistoryModel.findOne({ matchId }).sort({ createdAt: -1 });
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

    private async persistState(state: MatchState) {
        const { liveStatus, inning, striker, nonStriker, bowler, currentOverBalls } = state;

        if (liveStatus) {
            liveStatus.currentStrikerId = striker?.playerId || null;
            liveStatus.currentNonStrikerId = nonStriker?.playerId || null;
            liveStatus.currentBowlerId = bowler?.playerId || null;
            liveStatus.overs = `${Math.floor(inning.totalBalls / 6)}.${inning.totalBalls % 6}`;
            liveStatus.score = `${inning.totalRuns}/${inning.totalWickets}`;
            
            // Sync lastWicket from inning to liveStatus
            if (inning.lastWicket) {
                liveStatus.lastWicket = inning.lastWicket;
            }
            
            await liveStatus.save();
        }

        // Ensure BattingScorecard isOnStrike flags are synchronized with LiveMatchStatus IDs
        if (striker || nonStriker) {
            // First, set all batsmen in this inning to non-striker
            await this.battingModel.updateMany(
                { matchId: inning.matchId, inningId: inning._id, isOut: false },
                { $set: { isOnStrike: false } }
            );
            
            // Then set the correct striker flag if striker exists
            if (striker) {
                await this.battingModel.updateOne(
                    { matchId: inning.matchId, inningId: inning._id, playerId: striker.playerId },
                    { $set: { isOnStrike: true } }
                );
            }
        }

        await Promise.all([
            inning.save(),
            striker ? striker.save() : Promise.resolve(),
            nonStriker ? nonStriker.save() : Promise.resolve(),
            bowler ? bowler.save() : Promise.resolve()
        ]);

        if (currentOverBalls.length > 0) {
            const overNum = Math.floor((inning.totalBalls - 1) / 6) + 1;
            await this.overSummaryModel.updateOne(
                { matchId: inning.matchId, inningId: inning._id, overNumber: overNum },
                { 
                    $set: { bowlerId: bowler?._id },
                    $push: { ballsData: { $each: currentOverBalls } } 
                },
                { upsert: true }
            );
        }
    }
}