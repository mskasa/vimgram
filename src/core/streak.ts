export type RoundVerdict = "great" | "verbose" | "timeout" | "gaveUp";

// Streak counts consecutive clears (great or verbose); a timeout or a
// give-up both reset it - giving up is a deliberate failure, not a freebie.
// Kept as its own module (see CLAUDE.md "経過時間表示と記録"): streak is a
// display-only running count, independent of the now-removed scoring system
// it used to live alongside in core/score.ts.
export function nextStreak(
	currentStreak: number,
	verdict: RoundVerdict,
): number {
	return verdict === "timeout" || verdict === "gaveUp" ? 0 : currentStreak + 1;
}
