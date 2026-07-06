import { describe, expect, it } from "vitest";
import type { Attempt } from "./attempt";
import type { Challenge } from "./challenges";
import {
	isLevelFullyCleared,
	summarizeChallengeProgress,
	summarizeLevelProgress,
} from "./progress";

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

describe("summarizeChallengeProgress", () => {
	it("is not cleared when there are no attempts", () => {
		expect(summarizeChallengeProgress(makeChallenge("a"), [])).toEqual({
			cleared: false,
			great: false,
		});
	});

	it("is cleared but not great when a successful attempt exceeds idealKeyCount", () => {
		const challenge = makeChallenge("a"); // idealKeyCount = 2 ("dw")
		const attempts = [makeAttempt({ keyCount: 5 })];
		expect(summarizeChallengeProgress(challenge, attempts)).toEqual({
			cleared: true,
			great: false,
		});
	});

	it("is great when a successful attempt is at or under idealKeyCount", () => {
		const challenge = makeChallenge("a");
		const attempts = [makeAttempt({ keyCount: 2 })];
		expect(summarizeChallengeProgress(challenge, attempts)).toEqual({
			cleared: true,
			great: true,
		});
	});

	it("ignores failed attempts and attempts for other challenges", () => {
		const challenge = makeChallenge("a");
		const attempts = [
			makeAttempt({ challengeId: "a", success: false, keyCount: 2 }),
			makeAttempt({ challengeId: "b", success: true, keyCount: 2 }),
		];
		expect(summarizeChallengeProgress(challenge, attempts)).toEqual({
			cleared: false,
			great: false,
		});
	});
});

describe("summarizeLevelProgress", () => {
	it("counts cleared and great challenges across the level", () => {
		const level = [makeChallenge("a"), makeChallenge("b"), makeChallenge("c")];
		const attempts = [
			makeAttempt({ challengeId: "a", keyCount: 2 }), // great
			makeAttempt({ challengeId: "b", keyCount: 9 }), // cleared, not great
		];
		expect(summarizeLevelProgress(level, attempts)).toEqual({
			totalChallenges: 3,
			clearedCount: 2,
			greatCount: 1,
		});
	});
});

describe("isLevelFullyCleared", () => {
	it("is false when the level has no challenges", () => {
		expect(isLevelFullyCleared([], [])).toBe(false);
	});

	it("is false until every challenge has a successful attempt", () => {
		const level = [makeChallenge("a"), makeChallenge("b")];
		const attempts = [makeAttempt({ challengeId: "a" })];
		expect(isLevelFullyCleared(level, attempts)).toBe(false);
	});

	it("is true once every challenge has a successful attempt", () => {
		const level = [makeChallenge("a"), makeChallenge("b")];
		const attempts = [
			makeAttempt({ challengeId: "a" }),
			makeAttempt({ challengeId: "b" }),
		];
		expect(isLevelFullyCleared(level, attempts)).toBe(true);
	});
});
