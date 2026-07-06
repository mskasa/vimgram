import type { Challenge } from "./challenges";

export type LevelGroup = {
	level: Challenge["difficulty"];
	challenges: Challenge[];
};

// A "level" is not a stored field - it's Challenge["difficulty"] itself
// (1 -> Level 1, ...). Grouping (rather than hardcoding "levels 1-4") means
// the menu adapts automatically once a Level 5 challenge is added.
export function groupByLevel(challenges: Challenge[]): LevelGroup[] {
	const byLevel = new Map<Challenge["difficulty"], Challenge[]>();
	for (const challenge of challenges) {
		const group = byLevel.get(challenge.difficulty);
		if (group) group.push(challenge);
		else byLevel.set(challenge.difficulty, [challenge]);
	}
	return [...byLevel.entries()]
		.sort(([a], [b]) => a - b)
		.map(([level, levelChallenges]) => ({
			level,
			challenges: levelChallenges,
		}));
}
