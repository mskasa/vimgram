import type { ChallengeStatsMap } from "./challengeStats";
import type { Challenge } from "./challenges";
import { groupByLevel } from "./levels";
import { isLevelFullyCleared } from "./progress";

// A player-facing achievement, independent of *how* it was reached (a
// straight level playthrough, a review session, retries, any mix) - see
// CLAUDE.md "永続化": detection lives here, in core, precisely so no screen
// or session type can forget to check for it. The union is deliberately
// small today (only "levelFullyCleared") but is where a future "levelAllGreat"
// milestone would be added without touching the detection call sites.
export type Milestone = {
	type: "levelFullyCleared";
	level: Challenge["difficulty"];
};

export function milestoneKey(milestone: Milestone): string {
	return `${milestone.type}:${milestone.level}`;
}

// Compares challengeStats before/after a single update and returns any
// milestone that was newly crossed by that update (empty array otherwise).
// Pure and stateless: it has no notion of "already celebrated" - that's the
// stored queue's job (see src/app/milestoneStorage.ts). Re-running this with
// the same prev/next pair is idempotent (an already-crossed threshold never
// re-fires, since `wasCleared` would already be true).
export function detectMilestones(
	prevStats: ChallengeStatsMap,
	nextStats: ChallengeStatsMap,
	challenges: Challenge[],
): Milestone[] {
	const detected: Milestone[] = [];
	for (const group of groupByLevel(challenges)) {
		const wasCleared = isLevelFullyCleared(group.challenges, prevStats);
		const isClearedNow = isLevelFullyCleared(group.challenges, nextStats);
		if (!wasCleared && isClearedNow) {
			detected.push({ type: "levelFullyCleared", level: group.level });
		}
	}
	return detected;
}

export type StoredMilestone = Milestone & { celebrated: boolean };

// Folds newly detected milestones into the persisted queue, skipping any
// that are already present (celebrated or not) - a milestone is recorded at
// most once in a lifetime. `detected` entries always start uncelebrated;
// `existing` entries keep whatever `celebrated` value they already had.
export function appendMilestones(
	existing: StoredMilestone[],
	detected: Milestone[],
): StoredMilestone[] {
	const existingKeys = new Set(existing.map(milestoneKey));
	const additions: StoredMilestone[] = detected
		.filter((milestone) => !existingKeys.has(milestoneKey(milestone)))
		.map((milestone) => ({ ...milestone, celebrated: false }));
	return [...existing, ...additions];
}
