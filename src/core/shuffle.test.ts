import { describe, expect, it } from "vitest";
import { shuffle } from "./shuffle";

// A tiny seeded LCG, not cryptographic - just needs to be deterministic and
// produce values in [0, 1) like Math.random, so shuffle's own tests can
// assert on an exact, reproducible order without depending on real randomness.
function seededRng(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

describe("shuffle", () => {
	it("preserves every element (a permutation, not a subset)", () => {
		const input = [1, 2, 3, 4, 5];
		const result = shuffle(input, seededRng(42));
		expect(result).toHaveLength(input.length);
		expect([...result].sort()).toEqual([...input].sort());
	});

	it("produces the same order for the same seed", () => {
		const input = ["a", "b", "c", "d", "e", "f"];
		const first = shuffle(input, seededRng(7));
		const second = shuffle(input, seededRng(7));
		expect(first).toEqual(second);
	});

	it("does not mutate the input array", () => {
		const input = [1, 2, 3];
		const original = [...input];
		shuffle(input, seededRng(1));
		expect(input).toEqual(original);
	});

	it("handles an empty array", () => {
		expect(shuffle([], seededRng(1))).toEqual([]);
	});

	it("handles a single-element array", () => {
		expect(shuffle(["only"], seededRng(1))).toEqual(["only"]);
	});

	it("can actually reorder elements (not a no-op) for a typical seed", () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8];
		const result = shuffle(input, seededRng(123));
		expect(result).not.toEqual(input);
	});
});
