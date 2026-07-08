import { describe, expect, it } from "vitest";
import type { ChallengeStatsMap } from "./challengeStats";
import type { Challenge } from "./challenges";
import { buildReviewQueue } from "./reviewQueue";

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

describe("buildReviewQueue", () => {
	const challenges = [
		makeChallenge("never-played"),
		makeChallenge("uncleared-old"),
		makeChallenge("uncleared-new"),
		makeChallenge("cleared-not-great"),
		makeChallenge("cleared-and-great"),
		makeChallenge("skip-only"),
		makeChallenge("great-then-failed"),
	];

	const stats: ChallengeStatsMap = {
		"uncleared-old": {
			clears: 0,
			greats: 0,
			attempts: 2,
			lastPlayedAt: 10,
			lastOutcome: "fail",
		},
		"uncleared-new": {
			clears: 0,
			greats: 0,
			attempts: 1,
			lastPlayedAt: 500,
			lastOutcome: "fail",
		},
		"cleared-not-great": {
			clears: 1,
			greats: 0,
			attempts: 3,
			lastPlayedAt: 200,
			lastOutcome: "redundant",
		},
		"cleared-and-great": {
			clears: 2,
			greats: 1,
			attempts: 2,
			lastPlayedAt: 300,
			lastOutcome: "great",
		},
		// skip/give-up-only rounds still update challengeStats (attempts > 0,
		// clears === 0) - so this counts as "uncleared", same as any other.
		"skip-only": {
			clears: 0,
			greats: 0,
			attempts: 1,
			lastPlayedAt: 50,
			lastOutcome: "fail",
		},
		// Attainment (clears/greats) says this was mastered once, but the most
		// recent REAL attempt failed - recency wins for review purposes (see
		// CLAUDE.md "永続化": 到達度と習熟度の分離).
		"great-then-failed": {
			clears: 1,
			greats: 1,
			attempts: 2,
			lastPlayedAt: 400,
			lastOutcome: "fail",
		},
	};

	it("'uncleared' includes played-but-never-cleared challenges, oldest lastPlayedAt first", () => {
		const queue = buildReviewQueue(challenges, stats, "uncleared");
		expect(queue.map((c) => c.id)).toEqual([
			"uncleared-old",
			"skip-only",
			"great-then-failed",
			"uncleared-new",
		]);
	});

	it("'uncleared' also includes a challenge with clears > 0 if its most recent attempt failed", () => {
		const queue = buildReviewQueue(challenges, stats, "uncleared");
		expect(queue.some((c) => c.id === "great-then-failed")).toBe(true);
	});

	it("excludes challenges with no stats entry at all (never played)", () => {
		const queue = buildReviewQueue(challenges, stats, "uncleared");
		expect(queue.some((c) => c.id === "never-played")).toBe(false);
	});

	it("'notGreat' includes only challenges whose most recent attempt was a clear-but-not-great (lastOutcome 'redundant'/'clear')", () => {
		const queue = buildReviewQueue(challenges, stats, "notGreat");
		expect(queue.map((c) => c.id)).toEqual(["cleared-not-great"]);
	});

	it("'notGreat' excludes a challenge whose most recent attempt failed, even if it was cleared before (recency wins)", () => {
		const queue = buildReviewQueue(challenges, stats, "notGreat");
		expect(queue.some((c) => c.id === "great-then-failed")).toBe(false);
	});

	it("excludes a challenge whose most recent attempt was Great from both buckets", () => {
		const uncleared = buildReviewQueue(challenges, stats, "uncleared");
		const notGreat = buildReviewQueue(challenges, stats, "notGreat");
		expect(uncleared.some((c) => c.id === "cleared-and-great")).toBe(false);
		expect(notGreat.some((c) => c.id === "cleared-and-great")).toBe(false);
	});

	it("returns an empty array when nothing matches", () => {
		expect(
			buildReviewQueue([makeChallenge("never-played")], {}, "uncleared"),
		).toEqual([]);
	});
});
