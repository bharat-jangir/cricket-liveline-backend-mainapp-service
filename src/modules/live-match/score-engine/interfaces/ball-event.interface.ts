
export interface BallEvent {
    matchId: string;
    type: 'RUN' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'WICKET' | 'UNDO' | 'OVER_END' | 'SWAP_BATSMAN';
    runs?: number; // 0, 1, 2, 3, 4, 6
    isBoundary?: boolean;
    wicketType?: string; // bowled, caught, etc.
    playerId?: string; // For wicket (who got out) or fielder
    helperId?: string; // For run out / catch (fielder)
    extras?: number;
    comments?: string;
    timestamp?: number;
    ballNumber?: number;
}
