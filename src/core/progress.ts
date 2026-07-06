import type { Attempt } from "./attempt";
import { type Challenge, idealKeyCount } from "./challenges";

export type ChallengeProgress = { cleared: boolean; great: boolean };

// Derives progress from the full Attempt history rather than storing it
// separately - "cleared" is any successful attempt ever recorded, "great"
// is any successful attempt that used <= idealKeyCount keys (mirrors
// judge.ts's great/verbose split).
export function summarizeChallengeProgress(
	challenge: Challenge,
	attempts: Attempt[],
): ChallengeProgress {
	const successes = attempts.filter(
		(a) => a.challengeId === challenge.id && a.success,
	);
	return {
		cleared: successes.length > 0,
		great: successes.some((a) => a.keyCount <= idealKeyCount(challenge)),
	};
}

export type LevelProgress = {
	totalChallenges: number;
	clearedCount: number;
	greatCount: number;
};

export function summarizeLevelProgress(
	levelChallenges: Challenge[],
	attempts: Attempt[],
): LevelProgress {
	let clearedCount = 0;
	let greatCount = 0;
	for (const challenge of levelChallenges) {
		const progress = summarizeChallengeProgress(challenge, attempts);
		if (progress.cleared) clearedCount++;
		if (progress.great) greatCount++;
	}
	return { totalChallenges: levelChallenges.length, clearedCount, greatCount };
}

// A level is "fully cleared" once every challenge in it has at least one
// successful attempt - the trigger for showing the Star button in the level
// summary the first time this becomes true (see CLAUDE.md "GitHub Star ボタン").
export function isLevelFullyCleared(
	levelChallenges: Challenge[],
	attempts: Attempt[],
): boolean {
	const { totalChallenges, clearedCount } = summarizeLevelProgress(
		levelChallenges,
		attempts,
	);
	return totalChallenges > 0 && clearedCount === totalChallenges;
}
