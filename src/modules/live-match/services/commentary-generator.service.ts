import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ball, BallDocument } from '../../../entities/ball.entity';
import { Milestone } from '../../../entities/milestone.entity';
import { OverSummary } from '../../../entities/over-summary.entity';
import { Inning, InningDocument } from '../../../entities/inning.entity';
import { Player } from '../../../entities/player.entity';
import { BattingScorecard } from '../../../entities/batting-scorecard.entity';

@Injectable()
export class CommentaryGeneratorService {
    private readonly logger = new Logger(CommentaryGeneratorService.name);

    constructor(
        @InjectModel(Player.name)
        private playerModel: Model<Player>,
        @InjectModel(BattingScorecard.name)
        private battingScorecardModel: Model<BattingScorecard>,
    ) { }

    async generateDefaultBallCommentary(
        ball: any,
        bowlerName: string,
        batsmanName: string,
    ): Promise<any> {
        const commentary = `${bowlerName} to ${batsmanName}`;
        return {
            ballId: new Types.ObjectId(),
            ballLabel: ball.runs?.toString() || '0',
            commentary,
            shortText: commentary,
            isLegal: !ball.isWide && !ball.isNoBall,
            type: 'ball',
            timestamp: new Date(),
        };
    }

    async createWicketHighlight(
        ball: BallDocument,
        dismissedPlayerId: Types.ObjectId,
        dismissalType: string,
        bowlerName: string,
        batsmanName: string,
        fielderName?: string,
    ): Promise<any> {
        const scorecard = await this.battingScorecardModel.findOne({
            matchId: ball.matchId,
            inningId: ball.inningId,
            playerId: dismissedPlayerId,
        });

        let commentary = '';
        let shortText = '';

        switch (dismissalType) {
            case 'caught':
                commentary = `${batsmanName} c ${fielderName || 'fielder'} b ${bowlerName}`;
                break;
            case 'bowled':
                commentary = `${batsmanName} b ${bowlerName}`;
                break;
            case 'lbw':
                commentary = `${batsmanName} lbw b ${bowlerName}`;
                break;
            case 'run_out':
                commentary = `${batsmanName} run out (${fielderName || 'fielder'})`;
                break;
            case 'stumped':
                commentary = `${batsmanName} st ${fielderName || 'keeper'} b ${bowlerName}`;
                break;
            case 'hit_wicket':
                commentary = `${batsmanName} hit wicket b ${bowlerName}`;
                break;
            default:
                commentary = `${batsmanName} out`;
        }
        shortText = `${batsmanName} OUT`;

        return {
            ballId: new Types.ObjectId(),
            ballLabel: 'W',
            commentary,
            shortText,
            isLegal: true,
            type: 'wicket',
            displayTheme: 'red',
            timestamp: ball.timestamp || new Date(),
            highlightData: {
                wicketDismissedPlayerId: dismissedPlayerId,
                wicketDismissalType: dismissalType,
                wicketBowlerName: bowlerName,
                wicketBatsmanName: batsmanName,
                wicketFielderName: fielderName,
                wicketBatsmanRuns: scorecard?.runs || 0,
                wicketBatsmanBalls: scorecard?.balls || 0,
                wicketBatsmanFours: scorecard?.fours || 0,
                wicketBatsmanSixes: scorecard?.sixes || 0,
                wicketBatsmanSR: scorecard?.strikeRate || 0,
            },
        };
    }

    async createMilestoneHighlight(
        milestone: Milestone,
        playerName: string,
    ): Promise<any> {
        let commentary = '';
        let shortText = '';
        let milestoneTypeStr = '';

        switch (milestone.type) {
            case 'fifty':
                milestoneTypeStr = '50';
                commentary = `${playerName} brings up his half-century in ${milestone.balls} balls`;
                break;
            case 'century':
                milestoneTypeStr = '100';
                commentary = `${playerName} reaches his century in ${milestone.balls} balls`;
                break;
            case 'double_century':
                milestoneTypeStr = '200';
                commentary = `${playerName} scores a magnificent double century in ${milestone.balls} balls`;
                break;
            case '5_wickets':
                milestoneTypeStr = '5-wicket';
                commentary = `${playerName} picks up his 5th wicket`;
                break;
            case 'hat_trick':
                milestoneTypeStr = 'hat-trick';
                commentary = `${playerName} completes a hat-trick!`;
                break;
            default:
                commentary = `${playerName} reaches milestone`;
        }
        shortText = `${playerName} milestone`;

        return {
            ballId: new Types.ObjectId().toString(),
            ballLabel: 'M',
            commentary,
            shortText,
            isLegal: true,
            type: 'milestone',
            displayTheme: 'gradient',
            timestamp: milestone.timestamp || new Date(),
            highlightData: {
                milestoneType: milestoneTypeStr,
                milestonePlayerName: playerName,
                milestoneValue: milestone.value,
                milestoneBalls: milestone.balls,
            },
        };
    }

    async createOverSummaryHighlight(
        overSummary: OverSummary,
        bowlerName: string,
    ): Promise<any> {
        const commentary = `End of Over ${overSummary.overNumber}: ${overSummary.runs} runs${overSummary.wickets > 0 ? `, ${overSummary.wickets} wicket${overSummary.wickets > 1 ? 's' : ''}` : ''
            }${overSummary.isMaiden ? ' (Maiden)' : ''}`;

        const shortText = `Over ${overSummary.overNumber}: ${overSummary.runs}/${overSummary.wickets}`;

        return {
            ballId: new Types.ObjectId().toString(),
            ballLabel: 'Over',
            commentary,
            shortText,
            isLegal: true,
            type: 'over_end',
            displayTheme: 'blue',
            timestamp: new Date(),
            highlightData: {
                overSummaryNumber: overSummary.overNumber,
                overSummaryBowlerName: bowlerName,
                overSummaryRuns: overSummary.runs,
                overSummaryWickets: overSummary.wickets,
                overSummaryBallsData: overSummary.ballsData || [],
            },
        };
    }

    async createInningsSummaryHighlight(
        inning: InningDocument,
        teamName: string,
    ): Promise<any> {
        const oversStr = `${Math.floor(inning.totalBalls / 6)}.${inning.totalBalls % 6}`;
        const commentary = `${teamName} scored ${inning.totalRuns}/${inning.totalWickets} in ${oversStr} overs`;
        const shortText = `${teamName}: ${inning.totalRuns}/${inning.totalWickets}`;

        return {
            ballId: new Types.ObjectId().toString(),
            ballLabel: 'Inn',
            commentary,
            shortText,
            isLegal: true,
            type: 'innings_summary',
            displayTheme: 'gradient',
            timestamp: new Date(),
            highlightData: {
                inningsTeamName: teamName,
                inningsTotalRuns: inning.totalRuns,
                inningsTotalWickets: inning.totalWickets,
                inningsTotalOvers: oversStr,
            },
        };
    }

    /**
     * Check if a batsman has reached a milestone
     */
    async checkBatsmanMilestone(
        matchId: Types.ObjectId,
        inningId: Types.ObjectId,
        playerId: Types.ObjectId,
        currentRuns: number,
    ): Promise<string | null> {
        const milestones = [50, 100, 150, 200, 250, 300];

        for (const milestone of milestones) {
            if (currentRuns === milestone) {
                return milestone.toString();
            }
        }

        return null;
    }

    /**
     * Check if a bowler has reached a milestone
     */
    async checkBowlerMilestone(
        matchId: Types.ObjectId,
        inningId: Types.ObjectId,
        playerId: Types.ObjectId,
        currentWickets: number,
    ): Promise<string | null> {
        if (currentWickets === 5) {
            return '5-wicket';
        }
        if (currentWickets === 10) {
            return '10-wicket';
        }

        return null;
    }
}
