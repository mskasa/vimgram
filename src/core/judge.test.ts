import { describe, expect, it } from "vitest";
import { createBuffer } from "./buffer";
import type { Challenge } from "./challenges";
import { judge, matchesExpected } from "./judge";

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
	return {
		id: "test-challenge",
		title: { en: "Test" },
		prompt: { en: "Test prompt" },
		initial: { text: "hello world", cursor: 0, mode: "normal" },
		expected: { text: "world" },
		examples: ["dw"],
		tags: ["test"],
		difficulty: 1,
		...overrides,
	};
}

describe("matchesExpected", () => {
	it("compares text always", () => {
		expect(matchesExpected(createBuffer("world", 0), { text: "world" })).toBe(
			true,
		);
		expect(matchesExpected(createBuffer("nope", 0), { text: "world" })).toBe(
			false,
		);
	});

	it("only compares cursor/mode/yankRegister when specified", () => {
		const state = createBuffer("world", 3);
		expect(matchesExpected(state, { text: "world" })).toBe(true);
		expect(matchesExpected(state, { text: "world", cursor: 3 })).toBe(true);
		expect(matchesExpected(state, { text: "world", cursor: 0 })).toBe(false);
	});

	it("compares yankRegister only when expected specifies it", () => {
		const state = { ...createBuffer("world", 0), yankRegister: "hello " };
		expect(matchesExpected(state, { text: "world" })).toBe(true);
		expect(
			matchesExpected(state, { text: "world", yankRegister: "hello " }),
		).toBe(true);
		expect(
			matchesExpected(state, { text: "world", yankRegister: "wrong" }),
		).toBe(false);
	});
});

describe("judge", () => {
	it("returns fail when the final state does not match", () => {
		const challenge = makeChallenge();
		const result = judge(challenge, createBuffer("hello world", 0), "x");
		expect(result).toEqual({ verdict: "fail" });
	});

	it("returns great when keys.length <= idealKeyCount", () => {
		const challenge = makeChallenge({ examples: ["dw"] }); // idealKeyCount = 2
		const result = judge(challenge, createBuffer("world", 0), "dw");
		expect(result).toEqual({ verdict: "great", keyCount: 2, idealKeyCount: 2 });
	});

	it("returns verbose when keys.length > idealKeyCount but the result matches", () => {
		const challenge = makeChallenge({ examples: ["dw"] }); // idealKeyCount = 2
		const result = judge(challenge, createBuffer("world", 0), "xxxxx");
		expect(result).toEqual({
			verdict: "verbose",
			keyCount: 5,
			idealKeyCount: 2,
		});
	});
});
