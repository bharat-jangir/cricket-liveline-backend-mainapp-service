
export interface BallEvent {
    matchId: string;
    type: string; // Allow any event type
    runs?: number; // 0, 1, 2, 3, 4, 6
    isBoundary?: boolean;
    wicketType?: string; // bowled, caught, etc.
    playerId?: string; // For wicket (who got out) or fielder
    helperId?: string; // For run out / catch (fielder)
    extras?: number;
    comments?: string;
    timestamp?: number;
    ballNumber?: number;
    isComposite?: boolean;
    parentType?: string; // e.g. 'WIDE' or 'NO_BALL' for composite sub-events
    speech?: boolean;
}
