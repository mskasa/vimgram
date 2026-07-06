import { describe, expect, it } from "vitest";
import type { Challenge } from "./challenges";
import { groupByLevel } from "./levels";

function makeChallenge(
	id: string,
	difficulty: Challenge["difficulty"],
): Challenge {
	return {
		id,
		title: { en: id },
		prompt: { en: id },
		initial: { text: "abc", cursor: 0, mode: "normal" },
		expected: { text: "abc" },
		examples: ["h"],
		tags: [],
		difficulty,
	};
}

describe("groupByLevel", () => {
	it("groups challenges by their difficulty", () => {
		const challenges = [
			makeChallenge("a", 2),
			makeChallenge("b", 1),
			makeChallenge("c", 1),
		];
		expect(groupByLevel(challenges)).toEqual([
			{ level: 1, challenges: [challenges[1], challenges[2]] },
			{ level: 2, challenges: [challenges[0]] },
		]);
	});

	it("sorts groups by level ascending regardless of input order", () => {
		const challenges = [makeChallenge("a", 4), makeChallenge("b", 3)];
		expect(groupByLevel(challenges).map((g) => g.level)).toEqual([3, 4]);
	});

	it("returns an empty array for no challenges", () => {
		expect(groupByLevel([])).toEqual([]);
	});
});
