import { describe, expect, it } from "vitest";
import type { Attempt } from "./attempt";
import {
	type ChallengeStatsMap,
	rebuildChallengeStatsFromAttempts,
	recordChallengeStats,
} from "./challengeStats";
import type { Challenge } from "./challenges";

function makeChallenge(id: string, examples = ["dw"]): Challenge {
	return {
		id,
		title: { en: id },
		prompt: { en: id },
		initial: { text: "hello world", cursor: 0, mode: "normal" },
		expected: { text: "world" },
		examples,
		tags: [],
		difficulty: 1,
	};
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
	return {
		challengeId: "a",
		input: "dw",
		success: true,
		elapsedMs: 1000,
		keyCount: 2,
		mistakeCount: 0,
		usedCommandTypes: ["d:w"],
		...overrides,
	};
}

describe("recordChallengeStats", () => {
	it("creates a fresh entry for a challenge with no prior stats", () => {
		const next = recordChallengeStats(
			{},
			{ challengeId: "a", outcome: "great", timestamp: 100 },
		);
		expect(next).toEqual({
			a: {
				clears: 1,
				greats: 1,
				attempts: 1,
				lastPlayedAt: 100,
				lastOutcome: "great",
			},
		});
	});

	it("increments attempts on a failed round, without touching clears/greats", () => {
		const next = recordChallengeStats(
			{},
			{ challengeId: "a", outcome: "fail", timestamp: 100 },
		);
		expect(next).toEqual({
			a: {
				clears: 0,
				greats: 0,
				attempts: 1,
				lastPlayedAt: 100,
				lastOutcome: "fail",
			},
		});
	});

	it("counts 'redundant' as a clear, but not a great", () => {
		const next = recordChallengeStats(
			{},
			{ challengeId: "a", outcome: "redundant", timestamp: 100 },
		);
		expect(next.a).toEqual({
			clears: 1,
			greats: 0,
			attempts: 1,
			lastPlayedAt: 100,
			lastOutcome: "redundant",
		});
	});

	it("accumulates across multiple outcomes for the same challenge", () => {
		let stats: ChallengeStatsMap = {};
		stats = recordChallengeStats(stats, {
			challengeId: "a",
			outcome: "fail",
			timestamp: 1,
		});
		stats = recordChallengeStats(stats, {
			challengeId: "a",
			outcome: "redundant",
			timestamp: 2,
		});
		stats = recordChallengeStats(stats, {
			challengeId: "a",
			outcome: "great",
			timestamp: 3,
		});
		expect(stats.a).toEqual({
			clears: 2,
			greats: 1,
			attempts: 3,
			lastPlayedAt: 3,
			lastOutcome: "great",
		});
	});

	it("does not mutate the input map", () => {
		const original: ChallengeStatsMap = {};
		recordChallengeStats(original, {
			challengeId: "a",
			outcome: "great",
			timestamp: 1,
		});
		expect(original).toEqual({});
	});

	it("keeps other challenges' entries untouched", () => {
		const stats: ChallengeStatsMap = {
			b: {
				clears: 5,
				greats: 2,
				attempts: 5,
				lastPlayedAt: 50,
				lastOutcome: "great",
			},
		};
		const next = recordChallengeStats(stats, {
			challengeId: "a",
			outcome: "great",
			timestamp: 100,
		});
		expect(next.b).toEqual(stats.b);
	});

	it("always overwrites lastPlayedAt with the newest timestamp", () => {
		let stats: ChallengeStatsMap = {};
		stats = recordChallengeStats(stats, {
			challengeId: "a",
			outcome: "great",
			timestamp: 500,
		});
		stats = recordChallengeStats(stats, {
			challengeId: "a",
			outcome: "fail",
			timestamp: 999,
		});
		expect(stats.a.lastPlayedAt).toBe(999);
	});

	describe("lastOutcome (proficiency, not attainment)", () => {
		it("overwrites lastOutcome with each new attempt, regardless of history", () => {
			let stats: ChallengeStatsMap = {};
			stats = recordChallengeStats(stats, {
				challengeId: "a",
				outcome: "great",
				timestamp: 1,
			});
			expect(stats.a.lastOutcome).toBe("great");
			// A later failed retry moves lastOutcome back to "fail" - this is
			// the whole point of proficiency tracking (see CLAUDE.md "永続化").
			stats = recordChallengeStats(stats, {
				challengeId: "a",
				outcome: "fail",
				timestamp: 2,
			});
			expect(stats.a.lastOutcome).toBe("fail");
		});

		it("a failed retry after a prior Great does NOT decrement clears/greats (attainment never rewinds)", () => {
			let stats: ChallengeStatsMap = {};
			stats = recordChallengeStats(stats, {
				challengeId: "a",
				outcome: "great",
				timestamp: 1,
			});
			stats = recordChallengeStats(stats, {
				challengeId: "a",
				outcome: "fail",
				timestamp: 2,
			});
			expect(stats.a.clears).toBe(1);
			expect(stats.a.greats).toBe(1);
			expect(stats.a.lastOutcome).toBe("fail");
		});

		it("outcome: null (skip, or an assisted success) leaves clears/greats/lastOutcome untouched, only attempts/lastPlayedAt move", () => {
			let stats: ChallengeStatsMap = {};
			stats = recordChallengeStats(stats, {
				challengeId: "a",
				outcome: "fail",
				timestamp: 1,
			});
			stats = recordChallengeStats(stats, {
				challengeId: "a",
				outcome: null,
				timestamp: 2,
			});
			expect(stats.a).toEqual({
				clears: 0,
				greats: 0,
				attempts: 2,
				lastPlayedAt: 2,
				lastOutcome: "fail",
			});
		});
	});
});

describe("rebuildChallengeStatsFromAttempts", () => {
	it("returns an empty map for no attempts", () => {
		expect(rebuildChallengeStatsFromAttempts([], [])).toEqual({});
	});

	it("uses the recorded `great` field when present, without re-deriving from keyCount", () => {
		const challenge = makeChallenge("a"); // idealKeyCount = 2 ("dw")
		const attempts = [
			// keyCount is well over ideal, but `great: true` is recorded directly.
			makeAttempt({ keyCount: 10, great: true }),
		];
		const stats = rebuildChallengeStatsFromAttempts(attempts, [challenge]);
		expect(stats.a.greats).toBe(1);
		expect(stats.a.lastOutcome).toBe("great");
	});

	it("falls back to an idealKeyCount comparison for pre-existing attempts with no `great` field", () => {
		const challenge = makeChallenge("a"); // idealKeyCount = 2
		const attempts = [
			makeAttempt({ keyCount: 2, great: undefined }), // at ideal -> great
			makeAttempt({ keyCount: 9, great: undefined }), // over ideal -> redundant
		];
		const stats = rebuildChallengeStatsFromAttempts(attempts, [challenge]);
		expect(stats.a).toEqual({
			clears: 2,
			greats: 1,
			attempts: 2,
			lastPlayedAt: 1,
			lastOutcome: "redundant",
		});
	});

	it("never counts a failed attempt as great, even if keyCount looks favorable", () => {
		const challenge = makeChallenge("a");
		const attempts = [
			makeAttempt({ success: false, keyCount: 1, great: undefined }),
		];
		const stats = rebuildChallengeStatsFromAttempts(attempts, [challenge]);
		expect(stats.a.greats).toBe(0);
		expect(stats.a.lastOutcome).toBe("fail");
	});

	it("does not touch clears/greats/lastOutcome for a skipped attempt", () => {
		const challenge = makeChallenge("a");
		const attempts = [makeAttempt({ skipped: true })];
		const stats = rebuildChallengeStatsFromAttempts(attempts, [challenge]);
		expect(stats.a).toEqual({
			clears: 0,
			greats: 0,
			attempts: 1,
			lastPlayedAt: 0,
			lastOutcome: "fail", // EMPTY_STATS default, never overwritten by a skip
		});
	});

	it("orders lastPlayedAt by log position so relative recency survives migration", () => {
		const challenge = makeChallenge("a");
		const attempts = [
			makeAttempt({ challengeId: "a" }),
			makeAttempt({ challengeId: "b" }),
			makeAttempt({ challengeId: "a" }),
		];
		const stats = rebuildChallengeStatsFromAttempts(attempts, [
			challenge,
			makeChallenge("b"),
		]);
		expect(stats.a.lastPlayedAt).toBeGreaterThan(stats.b.lastPlayedAt);
	});

	it("keeps working for an attempt whose challenge no longer exists in the current challenge list", () => {
		const attempts = [makeAttempt({ challengeId: "removed-challenge" })];
		expect(() => rebuildChallengeStatsFromAttempts(attempts, [])).not.toThrow();
		const stats = rebuildChallengeStatsFromAttempts(attempts, []);
		// Can't know idealKeyCount for a challenge that no longer exists, so it
		// falls back to "not great" (redundant) rather than throwing or guessing.
		expect(stats["removed-challenge"]).toEqual({
			clears: 1,
			greats: 0,
			attempts: 1,
			lastPlayedAt: 0,
			lastOutcome: "redundant",
		});
	});
});
