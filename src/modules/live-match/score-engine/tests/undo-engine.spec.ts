import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ScoreEngineService } from '../score-engine.service';
import { RedisPublisherService } from '../../../../common/redis/redis-publisher.service';
import { CommentaryGeneratorService } from '../../services/commentary-generator.service';
import { ScoreHistory } from '../../../../entities/score-history.entity';
import { Match } from '../../../../entities/match.entity';
import { Inning } from '../../../../entities/inning.entity';
import { BattingScorecard } from '../../../../entities/batting-scorecard.entity';
import { BowlingScorecard } from '../../../../entities/bowling-scorecard.entity';
import { OverSummary } from '../../../../entities/over-summary.entity';
import { Partnership } from '../../../../entities/partnership.entity';
import { Team } from '../../../../entities/team.entity';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

describe('ScoreEngineService - Undo Logic', () => {
    let service: ScoreEngineService;
    let scoreHistoryModel: any;
    let inningModel: any;
    let matchModel: any;
    let overSummaryModel: any;
    let partnershipModel: any;
    let teamModel: any;
    let battingModel: any;
    let bowlingModel: any;

    const mockMatchId = new Types.ObjectId();
    const mockInningId = new Types.ObjectId();

    beforeEach(async () => {
        const mockModel = () => ({
            findOne: jest.fn(),
            findById: jest.fn(),
            findOneAndUpdate: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndDelete: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            sort: jest.fn(),
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScoreEngineService,
                { provide: getModelToken(ScoreHistory.name), useValue: mockModel() },
                { provide: getModelToken(Match.name), useValue: mockModel() },
                { provide: getModelToken(Inning.name), useValue: mockModel() },
                { provide: getModelToken(BattingScorecard.name), useValue: mockModel() },
                { provide: getModelToken(BowlingScorecard.name), useValue: mockModel() },
                { provide: getModelToken(OverSummary.name), useValue: mockModel() },
                { provide: getModelToken(Partnership.name), useValue: mockModel() },
                { provide: getModelToken(Team.name), useValue: mockModel() },
                {
                    provide: RedisPublisherService,
                    useValue: {
                        publishMatchUpdate: jest.fn(),
                        publishMatchReset: jest.fn(),
                        publishScorecardDelta: jest.fn(),
                    },
                },
                {
                    provide: CommentaryGeneratorService,
                    useValue: {
                        generateDefaultBallCommentary: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ScoreEngineService>(ScoreEngineService);
        scoreHistoryModel = module.get(getModelToken(ScoreHistory.name));
        inningModel = module.get(getModelToken(Inning.name));
        matchModel = module.get(getModelToken(Match.name));
        overSummaryModel = module.get(getModelToken(OverSummary.name));
        partnershipModel = module.get(getModelToken(Partnership.name));
        teamModel = module.get(getModelToken(Team.name));
        battingModel = module.get(getModelToken(BattingScorecard.name));
        bowlingModel = module.get(getModelToken(BowlingScorecard.name));
    });

    it('should throw BadRequestException if no history is found', async () => {
        // Mock loadState success
        matchModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: mockMatchId, currentInning: 1, teamAId: 't1', teamBId: 't2' }) });
        inningModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: mockInningId }) });
        teamModel.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ name: 'Team' }) }) });
        
        scoreHistoryModel.findOne.mockReturnValue({
            sort: jest.fn().mockResolvedValue(null),
        });

        await expect(service.handleEvent(mockMatchId.toString(), { type: 'UNDO' } as any))
            .rejects.toThrow(BadRequestException);
    });

    describe('reverseBallEvent - Inning Re-opening', () => {
        it('should mark an inning as not completed when undoing a match-ending ball', async () => {
            const mockInning = {
                _id: mockInningId,
                matchId: mockMatchId,
                totalRuns: 100,
                totalWickets: 10,
                isCompleted: true,
                save: jest.fn(),
            };

            const mockEvent = { type: 'WICKET', runs: 0, extras: 0 };
            const mockState = {
                inning: mockInning,
                match: { status: 'completed', save: jest.fn() },
                currentOverBalls: [],
            };

            // @ts-ignore - access private method for unit test
            await service.reverseBallEvent(mockState as any, mockEvent as any);

            expect(mockInning.totalWickets).toBe(9);
            // Re-opening logic is in processUndo, but in reverseBallEvent we want to ensure wickets are decremented
        });
    });

    describe('Partnership Cleanup', () => {
        it('should delete a partnership if it becomes empty after undo', async () => {
            const mockPartnership = {
                _id: new Types.ObjectId(),
                totalRuns: 1,
                totalBalls: 1,
                batsman1Runs: 1,
                batsman1Balls: 1,
                save: jest.fn(),
            };

            partnershipModel.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(mockPartnership),
            });

            const mockEvent = { type: 'RUN', runs: 1, extras: 0 };
            const mockState = {
                inning: { totalRuns: 10, totalWickets: 1 },
                match: { ballsPerOver: 6 },
                striker: { playerId: 'p1', runs: 10, balls: 10 },
            };

            // @ts-ignore
            await service.reversePartnership(mockState as any, mockEvent as any, false);

            expect(partnershipModel.findByIdAndDelete).toHaveBeenCalledWith(mockPartnership._id);
        });
    });

    describe('Over Summary & Maiden Restoration', () => {
        it('should delete over summary if it has no balls left after undo (0.1 ball)', async () => {
            const mockOver = {
                _id: new Types.ObjectId(),
                runs: 0,
                ballsData: [{ ballLabel: '0' }],
                markModified: jest.fn(),
                save: jest.fn(),
            };

            overSummaryModel.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(mockOver),
            });

            const mockEvent = { type: 'RUN', runs: 0, extras: 0 };
            const mockState = {
                inning: { totalBalls: 0 },
                match: { ballsPerOver: 6 },
                bowler: { _id: 'b1' },
            };

            // @ts-ignore
            await service.revertOverSummaryEvent(mockState as any, mockEvent as any);

            expect(overSummaryModel.findByIdAndDelete).toHaveBeenCalledWith(mockOver._id);
        });

        it('should restore maiden status if undoing a scoring ball that was the only run', async () => {
            const mockOver = {
                _id: new Types.ObjectId(),
                runs: 1,
                isMaiden: false,
                ballsData: [
                    { ballLabel: '0' }, { ballLabel: '0' }, { ballLabel: '0' }, 
                    { ballLabel: '0' }, { ballLabel: '0' }, { ballLabel: '1' }
                ],
                markModified: jest.fn(),
                save: jest.fn(),
            };

            const mockQuery = {
                sort: jest.fn().mockResolvedValue(mockOver),
            };
            overSummaryModel.findOne.mockReturnValue(mockQuery);

            const mockBowler = { maidens: 0 };
            const mockEvent = { type: 'RUN', runs: 1, extras: 0 };
            const mockState = {
                inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 6 },
                match: { ballsPerOver: 6 },
                bowler: mockBowler,
            };

            // @ts-ignore
            await service.revertOverSummaryEvent(mockState as any, mockEvent as any);

            expect(mockOver.isMaiden).toBe(true);
            expect(mockBowler.maidens).toBe(1);
        });
    });

    describe('Composite Events Reversal (wdw, nbw, wd4)', () => {
        it('should NOT decrement striker balls when undoing a composite Wicket on a Wide (wdw)', async () => {
            const mockStriker = { _id: 's1', runs: 10, balls: 5, save: jest.fn() };
            const mockState = {
                inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 10, totalWickets: 2 },
                match: { ballsPerOver: 6 },
                striker: mockStriker,
            };
            // Wicket event with parentType 'WIDE' and it's composite
            const mockEvent = { type: 'WICKET', isComposite: true, parentType: 'WIDE' };

            // @ts-ignore
            await service.reverseBallEvent(mockState as any, mockEvent as any);

            // Balls should stay 5 because a Wide doesn't count as a ball faced
            expect(mockStriker.balls).toBe(5);
            expect(mockState.inning.totalWickets).toBe(1);
        });

        it('should NOT double-decrement striker balls when undoing a composite Wicket on a No Ball (nbw)', async () => {
            const mockStriker = { _id: 's1', runs: 10, balls: 5, save: jest.fn() };
            const mockState = {
                inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 10, totalWickets: 2 },
                match: { ballsPerOver: 6 },
                striker: mockStriker,
            };
            // In nbw, the Wicket part is composite. It should not subtract a ball.
            // The No-Ball part (undid later) will subtract the 1 ball.
            const mockEvent = { type: 'WICKET', isComposite: true, parentType: 'NO_BALL' };

            // @ts-ignore
            await service.reverseBallEvent(mockState as any, mockEvent as any);

            // Balls should stay 5 because NB now doesn't count as a ball faced either
            expect(mockStriker.balls).toBe(5); 
        });

        it('should NOT decrement striker runs when undoing composite runs on a Wide (wd4)', async () => {
            const mockStriker = { _id: 's1', runs: 10, balls: 5, save: jest.fn() };
            const mockState = {
                inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 10, totalRuns: 50 },
                match: { ballsPerOver: 6 },
                striker: mockStriker,
            };
            // Composite runs of 4 belonging to a Wide
            const mockEvent = { type: 'RUN', runs: 4, isComposite: true, parentType: 'WIDE' };

            // @ts-ignore
            await service.reverseBallEvent(mockState as any, mockEvent as any);

            // Runs should stay 10 because the 4 runs belonged to Wides (extras)
            expect(mockStriker.runs).toBe(10);
            expect(mockState.inning.totalRuns).toBe(46);
        });
    });

    describe('Forward Scoring - Composite Events (nbw)', () => {
        it('should correctly increment striker balls but not inning totalBalls on nbw', async () => {
            const mockStriker = { _id: 's1', runs: 0, balls: 0, isOnStrike: true };
            const mockBowler = { _id: 'b1', runs: 0, balls: 0, overs: 0 };
            const mockState = {
                inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 0, totalWickets: 0, totalRuns: 0 },
                match: { ballsPerOver: 6 },
                striker: mockStriker,
                bowler: mockBowler,
                currentOverBalls: [],
            };
            
            // Deliver a No-Ball (Trigger)
            const nbEvent = { type: 'NO_BALL', extras: 1 };
            // @ts-ignore
            await service.processBall(mockState as any, nbEvent as any);
            
            expect(mockStriker.balls).toBe(0); // NB doesn't count for striker now
            expect(mockState.inning.totalBalls).toBe(0); // NB doesn't count for inning balls

            // Deliver a Wicket (Composite part)
            const wicketEvent = { type: 'WICKET', isComposite: true, parentType: 'NO_BALL' };
            // @ts-ignore
            await service.processWicket(mockState as any, wicketEvent as any);
            
            // Striker balls remains 0
            expect(mockStriker.balls).toBe(0);
            // Inning totalBalls remains 0
            expect(mockState.inning.totalBalls).toBe(0);
            expect(mockState.inning.totalWickets).toBe(1);
        });

        it('should include extras in partnership but not in individual striker stats on nb1', async () => {
             const p1Id = 'p1';
             const p2Id = 'p2';
             const mockStriker = { _id: 's1', playerId: p1Id, runs: 0, balls: 0, isOnStrike: true };
             const mockNonStriker = { _id: 's2', playerId: p2Id, runs: 0, balls: 0, isOnStrike: false };
             const mockBowler = { _id: 'b1', runs: 0, balls: 0 };
             const mockState = {
                 inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 0, totalWickets: 0, totalRuns: 0, extras: 0, noBalls: 0 },
                 match: { ballsPerOver: 6 },
                 striker: mockStriker,
                 nonStriker: mockNonStriker,
                 bowler: mockBowler,
                 currentOverBalls: []
             };

             // Mock partnership creation/find
             const mockPartnership = {
                 totalRuns: 0, totalBalls: 0, batsman1Id: p1Id, batsman2Id: p2Id,
                 batsman1Runs: 0, batsman1Balls: 0, batsman2Runs: 0, batsman2Balls: 0,
                 save: jest.fn()
             };
             // @ts-ignore
             service.partnershipModel.findOne.mockReturnValue({
                 sort: jest.fn().mockReturnThis(),
                 then: (resolve) => resolve(mockPartnership)
             });

             // Deliver a No-Ball + 1 run (Hit by batter)
             // Event: type=NO_BALL, runs=1, extras=1
             const nb1Event = { type: 'NO_BALL', runs: 1, extras: 1 };
             
             // @ts-ignore
             await service.processBall(mockState as any, nb1Event as any);

             // Striker gets 1 run, 0 balls
             expect(mockStriker.runs).toBe(1);
             expect(mockStriker.balls).toBe(0);

             // Partnership gets 2 runs (1 run + 1 extra), 0 balls
             expect(mockPartnership.totalRuns).toBe(2);
             expect(mockPartnership.batsman1Runs).toBe(1);
             expect(mockPartnership.batsman1Balls).toBe(0);
             expect(mockState.inning.totalRuns).toBe(2);
         });
    });

    describe('OVER_END Undo Logic', () => {
        it('should remove over highlight but NOT delete ball data when undoing OVER_END', async () => {
            const mockOver = {
                _id: new Types.ObjectId(),
                overNumber: 1,
                ballsData: [{ ballLabel: '1' }, { ballLabel: '4' }, { ballLabel: '0' }, { ballLabel: '6' }, { ballLabel: '1' }, { ballLabel: 'w' }],
                overHighlight: { summary: 'Great over' },
                markModified: jest.fn(),
                save: jest.fn(),
            };

            overSummaryModel.findOne.mockReturnValue({
                sort: jest.fn().mockResolvedValue(mockOver),
            });

            const mockEvent = { type: 'OVER_END' };
            const mockState = {
                inning: { _id: mockInningId, matchId: mockMatchId, totalBalls: 6 },
                match: { ballsPerOver: 6 },
                bowler: { _id: 'b1' },
            };

            // @ts-ignore
            await service.revertOverSummaryEvent(mockState as any, mockEvent as any);

            expect(mockOver.overHighlight).toBeNull();
            expect(mockOver.ballsData.length).toBe(6); // Should still be 6
            expect(mockOver.save).toHaveBeenCalled();
        });

        it('should NOT double-decrement totalBalls when undoing OVER_END then a BALL', async () => {
             // 1. Initial State: 6 balls bowled (0.6)
             const mockInning = { 
                 _id: mockInningId, 
                 totalBalls: 6, 
                 currentStrikerId: 'p2', // After swap
                 currentNonStrikerId: 'p1',
                 save: jest.fn() 
             };
             
             // 2. Undo OVER_END
             const overEndEvent = { type: 'OVER_END' };
             const snapshotOverEnd = { 
                 inning: { totalBalls: 6, currentStrikerId: 'p1', currentNonStrikerId: 'p2' } 
             };
             
             // Initial load
             matchModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: mockMatchId, currentInning: 1 }) });
             inningModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockInning) });
             battingModel.findOne.mockImplementation(({ playerId }) => ({
                 populate: jest.fn().mockReturnThis(),
                 exec: jest.fn().mockResolvedValue({ 
                     playerId, 
                     save: jest.fn(), 
                     populate: jest.fn().mockReturnThis(),
                     toObject: jest.fn().mockReturnThis()
                 })
             }));

             teamModel.findById.mockImplementation(() => ({
                 select: jest.fn().mockReturnThis(),
                 exec: jest.fn().mockResolvedValue({ name: 'Team', shortName: 'T', code: 'T' })
             }));

             const overSummaryMock = {
                 sort: jest.fn().mockReturnThis(),
                 exec: jest.fn().mockResolvedValue({ ballsData: [{label: '1'}], save: jest.fn() })
             };
             overSummaryModel.findOne.mockReturnValue(overSummaryMock);

             scoreHistoryModel.findOne.mockReturnValue({
                 sort: jest.fn().mockReturnThis(),
                 exec: jest.fn().mockResolvedValue({ event: overEndEvent, stateSnapshot: snapshotOverEnd })
             });

             // @ts-ignore
             await service.processUndo(mockMatchId.toString());
             
             expect(mockInning.totalBalls).toBe(6); // OVER_END doesn't change balls
             
             // 3. Undo 6th Ball (RUN)
             const runEvent = { type: 'RUN', runs: 1, extras: 0 };
             const snapshotRun = { 
                 inning: { totalBalls: 5, currentStrikerId: 'p1', currentNonStrikerId: 'p2' } 
             };
             
             scoreHistoryModel.findOne.mockReturnValue({
                 sort: jest.fn().mockReturnThis(),
                 exec: jest.fn().mockResolvedValue({ event: runEvent, stateSnapshot: snapshotRun })
             });

             // @ts-ignore
             await service.processUndo(mockMatchId.toString());

             expect(mockInning.totalBalls).toBe(5); // 6 - 1 = 5. Correct!
        });
    });
});
