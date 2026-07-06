export type ScoreInput = {
	remainingTimeMs: number;
	idealKeys: number;
	actualKeys: number;
	streak: number;
	mistakes: number;
};

// Score formula from CLAUDE.md "スコアリングと記録":
//   1000 + remainingTimeMs*0.1 + max(0, idealKeys-actualKeys)*100 + streak*50 - mistakes*100
// `mistakes` is the count of not-found ("found: false") command resolutions
// during the attempt (f/t with no match, an unresolved text object, ...);
// `idealKeys` comes from challenges.ts's idealKeyCount.
export function computeScore(input: ScoreInput): number {
	const efficiencyBonus = Math.max(0, input.idealKeys - input.actualKeys) * 100;
	const raw =
		1000 +
		input.remainingTimeMs * 0.1 +
		efficiencyBonus +
		input.streak * 50 -
		input.mistakes * 100;
	return Math.round(raw);
}

export type RoundVerdict = "great" | "verbose" | "timeout" | "gaveUp";

// Streak counts consecutive clears (great or verbose); a timeout or a
// give-up both reset it - giving up is a deliberate failure, not a freebie.
export function nextStreak(
	currentStreak: number,
	verdict: RoundVerdict,
): number {
	return verdict === "timeout" || verdict === "gaveUp" ? 0 : currentStreak + 1;
}
