import { describe, expect, it } from "vitest";
import type { ChallengeStats, ChallengeStatsMap } from "./challengeStats";
import type { Challenge } from "./challenges";
import { isLevelFullyCleared, summarizeLevelProgress } from "./progress";

function makeChallenge(id: string): Challenge {
	return {
		id,
		title: { en: id },
		prompt: { en: id },
		initial: { text: "hello world", cursor: 0, mode: "normal" },
		expected: { text: "world" },
		examples: ["dw"],
		tags: [],
		difficulty: 1,
	};
}

function makeStats(overrides: Partial<ChallengeStats> = {}): ChallengeStats {
	return {
		clears: 1,
		greats: 0,
		attempts: 1,
		lastPlayedAt: 1,
		lastOutcome: "great",
		...overrides,
	};
}

describe("summarizeLevelProgress", () => {
	it("counts nothing for challenges with no stats entry at all", () => {
		const level = [makeChallenge("a")];
		expect(summarizeLevelProgress(level, {})).toEqual({
			totalChallenges: 1,
			clearedCount: 0,
			greatCount: 0,
		});
	});

	it("counts cleared and great challenges across the level", () => {
		const level = [makeChallenge("a"), makeChallenge("b"), makeChallenge("c")];
		const stats: ChallengeStatsMap = {
			a: makeStats({ clears: 1, greats: 1 }), // great
			b: makeStats({ clears: 1, greats: 0 }), // cleared, not great
		};
		expect(summarizeLevelProgress(level, stats)).toEqual({
			totalChallenges: 3,
			clearedCount: 2,
			greatCount: 1,
		});
	});

	it("does not count a challenge with clears: 0 (played but not cleared) as cleared", () => {
		const level = [makeChallenge("a")];
		const stats: ChallengeStatsMap = { a: makeStats({ clears: 0, greats: 0 }) };
		expect(summarizeLevelProgress(level, stats)).toEqual({
			totalChallenges: 1,
			clearedCount: 0,
			greatCount: 0,
		});
	});
});

describe("isLevelFullyCleared", () => {
	it("is false when the level has no challenges", () => {
		expect(isLevelFullyCleared([], {})).toBe(false);
	});

	it("is false until every challenge has been cleared at least once", () => {
		const level = [makeChallenge("a"), makeChallenge("b")];
		const stats: ChallengeStatsMap = { a: makeStats() };
		expect(isLevelFullyCleared(level, stats)).toBe(false);
	});

	it("is true once every challenge has been cleared at least once", () => {
		const level = [makeChallenge("a"), makeChallenge("b")];
		const stats: ChallengeStatsMap = { a: makeStats(), b: makeStats() };
		expect(isLevelFullyCleared(level, stats)).toBe(true);
	});

	// Attainment (clears/greats) is monotonic and must never rewind based on
	// proficiency (lastOutcome) - see CLAUDE.md "永続化": 到達度と習熟度の分離.
	it("stays true even when a challenge's most recent attempt was a failure (lastOutcome ignored entirely)", () => {
		const level = [makeChallenge("a"), makeChallenge("b")];
		const stats: ChallengeStatsMap = {
			a: makeStats({ lastOutcome: "fail" }),
			b: makeStats({ lastOutcome: "fail" }),
		};
		expect(isLevelFullyCleared(level, stats)).toBe(true);
		expect(summarizeLevelProgress(level, stats)).toEqual({
			totalChallenges: 2,
			clearedCount: 2,
			greatCount: 0,
		});
	});
});
