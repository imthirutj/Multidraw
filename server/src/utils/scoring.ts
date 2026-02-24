/**
 * Score based on how quickly the player guessed.
 * Max 500 pts (instant), min 50 pts (last second).
 */
export function calculateScore(timeLeft: number, totalTime: number): number {
    const ratio = totalTime > 0 ? timeLeft / totalTime : 0;
    return Math.max(50, Math.round(500 * ratio));
}

/** Partial score awarded to the drawer when someone guesses correctly. */
export function calculateDrawerBonus(guesserScore: number): number {
    return Math.round(guesserScore * 0.4);
}

/** Generate a short random alphanumeric room code. */
export function generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
