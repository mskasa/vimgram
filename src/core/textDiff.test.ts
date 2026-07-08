import { describe, expect, it } from "vitest";
import { diffText } from "./textDiff";

describe("diffText", () => {
	it("finds a pure deletion (df, on 'apple, banana')", () => {
		expect(diffText("apple, banana", "banana")).toEqual({
			prefix: "",
			removed: "apple, ",
			added: "",
			suffix: "banana",
		});
	});

	it("finds a change (deleted then replaced with typed text)", () => {
		// ciw<Esc> replacing "foo" with "xyz" in "foo bar"
		expect(diffText("foo bar", "xyz bar")).toEqual({
			prefix: "",
			removed: "foo",
			added: "xyz",
			suffix: " bar",
		});
	});

	it("reports no change when before and after are identical (yank)", () => {
		expect(diffText("hello world", "hello world")).toEqual({
			prefix: "hello world",
			removed: "",
			added: "",
			suffix: "",
		});
	});

	it("handles a change spanning the whole string (no common prefix/suffix)", () => {
		expect(diffText("abc", "xyz")).toEqual({
			prefix: "",
			removed: "abc",
			added: "xyz",
			suffix: "",
		});
	});

	it("handles the after string being empty", () => {
		expect(diffText("abc", "")).toEqual({
			prefix: "",
			removed: "abc",
			added: "",
			suffix: "",
		});
	});

	it("handles a common prefix and suffix around a shorter replacement", () => {
		// e.g. ci" turning "say "hello" now" into "say "hi" now" - prefix
		// trimming is greedy per character, so the shared leading "h" of
		// "hello"/"hi" is absorbed into the prefix rather than the removed span.
		expect(diffText('say "hello" now', 'say "hi" now')).toEqual({
			prefix: 'say "h',
			removed: "ello",
			added: "i",
			suffix: '" now',
		});
	});
});
