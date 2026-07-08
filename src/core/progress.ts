import type { ChallengeStatsMap } from "./challengeStats";
import type { Challenge } from "./challenges";

export type LevelProgress = {
	totalChallenges: number;
	clearedCount: number;
	greatCount: number;
};

// challengeStats is the source of truth for clear/Great counts (see
// CLAUDE.md "永続化") - this just aggregates its already-computed per-
// challenge fields across one level, without re-deriving anything from the
// raw Attempt log (that log rotates, and re-deriving "Great" from keyCount
// would risk drifting from judge.ts's own formula).
export function summarizeLevelProgress(
	levelChallenges: Challenge[],
	stats: ChallengeStatsMap,
): LevelProgress {
	let clearedCount = 0;
	let greatCount = 0;
	for (const challenge of levelChallenges) {
		const entry = stats[challenge.id];
		if (entry && entry.clears > 0) clearedCount++;
		if (entry && entry.greats > 0) greatCount++;
	}
	return { totalChallenges: levelChallenges.length, clearedCount, greatCount };
}

// A level is "fully cleared" once every challenge in it has at least one
// clear - the trigger for showing the Star button in the level summary the
// first time this becomes true (see CLAUDE.md "GitHub Star ボタン"), and for
// shuffling the level's order on replay (see CLAUDE.md "シャッフル").
export function isLevelFullyCleared(
	levelChallenges: Challenge[],
	stats: ChallengeStatsMap,
): boolean {
	const { totalChallenges, clearedCount } = summarizeLevelProgress(
		levelChallenges,
		stats,
	);
	return totalChallenges > 0 && clearedCount === totalChallenges;
}
