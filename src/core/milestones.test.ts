import { describe, expect, it } from "vitest";
import type { ChallengeStatsMap } from "./challengeStats";
import type { Challenge } from "./challenges";
import {
	appendMilestones,
	detectMilestones,
	type Milestone,
	type StoredMilestone,
} from "./milestones";

function makeChallenge(
	id: string,
	difficulty: Challenge["difficulty"],
): Challenge {
	return {
		id,
		title: { en: id },
		prompt: { en: id },
		initial: { text: "hello world", cursor: 0, mode: "normal" },
		expected: { text: "world" },
		examples: ["dw"],
		tags: [],
		difficulty,
	};
}

function makeStats(clears: number): {
	clears: number;
	greats: number;
	attempts: number;
	lastPlayedAt: number;
	lastOutcome: "great" | "clear" | "redundant" | "fail";
} {
	return {
		clears,
		greats: 0,
		attempts: clears,
		lastPlayedAt: 1,
		lastOutcome: clears > 0 ? "great" : "fail",
	};
}

describe("detectMilestones", () => {
	const level1 = [makeChallenge("a", 1), makeChallenge("b", 1)];
	const level2 = [makeChallenge("c", 2)];
	const challenges = [...level1, ...level2];

	it("fires when the last uncleared challenge in a level is cleared", () => {
		const prev: ChallengeStatsMap = { a: makeStats(1), b: makeStats(0) };
		const next: ChallengeStatsMap = { a: makeStats(1), b: makeStats(1) };
		expect(detectMilestones(prev, next, challenges)).toEqual([
			{ type: "levelFullyCleared", level: 1 },
		]);
	});

	it("does not fire again when replaying an already-fully-cleared level", () => {
		const prev: ChallengeStatsMap = { a: makeStats(1), b: makeStats(1) };
		// Clearing challenge "a" again (a retry/replay) - still fully cleared
		// both before and after, so nothing NEW was crossed.
		const next: ChallengeStatsMap = { a: makeStats(2), b: makeStats(1) };
		expect(detectMilestones(prev, next, challenges)).toEqual([]);
	});

	it("fires for multiple levels at once if both cross the threshold in the same update", () => {
		// A contrived case (a single outcome only ever belongs to one
		// challenge/level in practice), but detectMilestones itself should
		// still report every level that newly became fully cleared between
		// the two given snapshots, regardless of how many that is.
		const prev: ChallengeStatsMap = { a: makeStats(1), b: makeStats(0) };
		const next: ChallengeStatsMap = {
			a: makeStats(1),
			b: makeStats(1),
			c: makeStats(1),
		};
		expect(detectMilestones(prev, next, challenges)).toEqual([
			{ type: "levelFullyCleared", level: 1 },
			{ type: "levelFullyCleared", level: 2 },
		]);
	});

	it("does not fire for a level that is still incomplete after the update", () => {
		const prev: ChallengeStatsMap = {};
		const next: ChallengeStatsMap = { a: makeStats(1) };
		expect(detectMilestones(prev, next, challenges)).toEqual([]);
	});

	it("does not fire when a level's challenges were already all cleared before this update (no-op update)", () => {
		const prev: ChallengeStatsMap = { a: makeStats(1), b: makeStats(1) };
		const next: ChallengeStatsMap = { a: makeStats(1), b: makeStats(1) };
		expect(detectMilestones(prev, next, challenges)).toEqual([]);
	});

	// Attainment must never rewind based on proficiency (see CLAUDE.md "永続化":
	// 到達度と習熟度の分離) - a milestone already reached stays reached even if
	// the player later fails a review attempt on one of that level's challenges.
	it("ignores lastOutcome entirely - a recent failure does not un-clear a level or re-fire its milestone", () => {
		const prev: ChallengeStatsMap = {
			a: { ...makeStats(1), lastOutcome: "great" },
			b: { ...makeStats(1), lastOutcome: "great" },
		};
		const next: ChallengeStatsMap = {
			a: { ...makeStats(1), lastOutcome: "fail" },
			b: { ...makeStats(1), lastOutcome: "great" },
		};
		expect(detectMilestones(prev, next, challenges)).toEqual([]);
	});
});

describe("appendMilestones", () => {
	it("appends newly detected milestones as uncelebrated", () => {
		const detected: Milestone[] = [{ type: "levelFullyCleared", level: 1 }];
		expect(appendMilestones([], detected)).toEqual([
			{ type: "levelFullyCleared", level: 1, celebrated: false },
		]);
	});

	it("does not duplicate a milestone that's already in the queue", () => {
		const existing: StoredMilestone[] = [
			{ type: "levelFullyCleared", level: 1, celebrated: true },
		];
		const detected: Milestone[] = [{ type: "levelFullyCleared", level: 1 }];
		expect(appendMilestones(existing, detected)).toEqual(existing);
	});

	it("keeps existing entries untouched while appending a new one", () => {
		const existing: StoredMilestone[] = [
			{ type: "levelFullyCleared", level: 1, celebrated: true },
		];
		const detected: Milestone[] = [{ type: "levelFullyCleared", level: 2 }];
		expect(appendMilestones(existing, detected)).toEqual([
			{ type: "levelFullyCleared", level: 1, celebrated: true },
			{ type: "levelFullyCleared", level: 2, celebrated: false },
		]);
	});
});
