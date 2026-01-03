import { LiveMatchStatusDocument } from '../../../../entities/live-match-status.entity';
import { InningDocument } from '../../../../entities/inning.entity';
import { BattingScorecardDocument } from '../../../../entities/batting-scorecard.entity';
import { BowlingScorecardDocument } from '../../../../entities/bowling-scorecard.entity';

export interface MatchState {
    liveStatus: LiveMatchStatusDocument;
    inning: InningDocument;
    striker: BattingScorecardDocument;
    nonStriker: BattingScorecardDocument;
    bowler: BowlingScorecardDocument;
    currentOverBalls: any[]; // Array of ball objects
}
