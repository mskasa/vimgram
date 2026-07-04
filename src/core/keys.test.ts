import { describe, expect, it } from "vitest";
import { tokenizeKeys } from "./keys";

describe("tokenizeKeys", () => {
	it("splits plain printable characters into single-character tokens", () => {
		expect(tokenizeKeys("df,")).toEqual(["d", "f", ","]);
	});

	it("treats a <...> group as a single token", () => {
		expect(tokenizeKeys("<Esc>")).toEqual(["<Esc>"]);
	});

	it('counts ci"jiro<Esc> as 8 tokens', () => {
		expect(tokenizeKeys('ci"jiro<Esc>')).toEqual([
			"c",
			"i",
			'"',
			"j",
			"i",
			"r",
			"o",
			"<Esc>",
		]);
	});

	it("handles multiple bracketed tokens in one sequence", () => {
		expect(tokenizeKeys("a<BS><Esc>")).toEqual(["a", "<BS>", "<Esc>"]);
	});

	it("returns an empty array for an empty string", () => {
		expect(tokenizeKeys("")).toEqual([]);
	});
});
