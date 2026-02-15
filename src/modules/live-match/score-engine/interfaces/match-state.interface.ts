import { InningDocument } from '../../../../entities/inning.entity';
import { BattingScorecardDocument } from '../../../../entities/batting-scorecard.entity';
import { BowlingScorecardDocument } from '../../../../entities/bowling-scorecard.entity';
import { MatchDocument } from '../../../../entities/match.entity';

export interface MatchState {
    match: MatchDocument;
    inning: InningDocument;
    striker: BattingScorecardDocument;
    nonStriker: BattingScorecardDocument;
    bowler: BowlingScorecardDocument;
    currentOverBalls: any[]; // Array of ball objects
}
