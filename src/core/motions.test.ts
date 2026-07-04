import { describe, expect, it } from "vitest";
import { createBuffer } from "./buffer";
import { type Motion, resolveMotion, resolveRange } from "./motions";

describe("resolveMotion: h / l / 0 / $", () => {
	it("h moves left by one, clamped at 0", () => {
		expect(resolveMotion(createBuffer("hello", 2), { type: "h" })).toEqual({
			to: 1,
			inclusive: false,
			found: true,
		});
		expect(resolveMotion(createBuffer("hello", 0), { type: "h" }).to).toBe(0);
	});

	it("l moves right by one, clamped at the last character", () => {
		expect(resolveMotion(createBuffer("hello", 1), { type: "l" }).to).toBe(2);
		expect(resolveMotion(createBuffer("hello", 4), { type: "l" }).to).toBe(4);
	});

	it("0 goes to the start of the line (exclusive)", () => {
		expect(resolveMotion(createBuffer("hello", 3), { type: "0" })).toEqual({
			to: 0,
			inclusive: false,
			found: true,
		});
	});

	it("$ goes to the last character (inclusive)", () => {
		expect(resolveMotion(createBuffer("hello", 0), { type: "$" })).toEqual({
			to: 4,
			inclusive: true,
			found: true,
		});
	});

	it("all resolve to 0 on an empty buffer", () => {
		const buf = createBuffer("");
		for (const motion of [
			{ type: "h" },
			{ type: "l" },
			{ type: "0" },
			{ type: "$" },
		] as const) {
			expect(resolveMotion(buf, motion).to).toBe(0);
		}
	});
});

describe("resolveMotion: w / e / b (word motions)", () => {
	it("w moves to the start of the next word, skipping trailing whitespace", () => {
		expect(resolveMotion(createBuffer("foo bar", 0), { type: "w" }).to).toBe(4);
	});

	it("w treats punctuation as its own word class", () => {
		expect(resolveMotion(createBuffer("foo.bar", 0), { type: "w" }).to).toBe(3);
		expect(resolveMotion(createBuffer("foo.bar", 3), { type: "w" }).to).toBe(4);
	});

	it("w at the last word clamps to the last character", () => {
		expect(resolveMotion(createBuffer("foo bar", 4), { type: "w" }).to).toBe(6);
	});

	it("e moves to the end of the current word when not already there", () => {
		expect(resolveMotion(createBuffer("foo bar", 0), { type: "e" })).toEqual({
			to: 2,
			inclusive: true,
			found: true,
		});
	});

	it("e jumps to the end of the next word when already at a word end", () => {
		expect(resolveMotion(createBuffer("foo bar", 2), { type: "e" }).to).toBe(6);
	});

	it("b moves to the start of the current word when not already there", () => {
		expect(resolveMotion(createBuffer("foo bar", 6), { type: "b" })).toEqual({
			to: 4,
			inclusive: false,
			found: true,
		});
	});

	it("b jumps to the start of the previous word when already at a word start", () => {
		expect(resolveMotion(createBuffer("foo bar", 4), { type: "b" }).to).toBe(0);
	});

	it("b at the start of the line clamps to 0", () => {
		expect(resolveMotion(createBuffer("foo bar", 0), { type: "b" }).to).toBe(0);
	});
});

describe("resolveMotion: f / t (char search)", () => {
	it("f finds the char and is inclusive", () => {
		expect(
			resolveMotion(createBuffer("a,b", 0), { type: "f", char: "," }),
		).toEqual({
			to: 1,
			inclusive: true,
			found: true,
		});
	});

	it("t stops at the raw target index but is exclusive (lands one char short)", () => {
		expect(
			resolveMotion(createBuffer("a,b", 0), { type: "t", char: "," }),
		).toEqual({
			to: 1,
			inclusive: false,
			found: true,
		});
	});

	it("f/t search strictly forward of the cursor, never matching the current char", () => {
		expect(
			resolveMotion(createBuffer(",ab", 0), { type: "f", char: "," }).found,
		).toBe(false);
	});

	it("f/t report found: false when the char does not occur", () => {
		expect(
			resolveMotion(createBuffer("abc", 0), { type: "f", char: "z" }).found,
		).toBe(false);
		expect(
			resolveMotion(createBuffer("abc", 0), { type: "t", char: "z" }).found,
		).toBe(false);
	});
});

describe("resolveRange", () => {
	it("computes an exclusive forward range as [from, to)", () => {
		expect(resolveRange(0, { to: 4, inclusive: false, found: true })).toEqual({
			start: 0,
			end: 4,
		});
	});

	it("computes an inclusive forward range as [from, to + 1)", () => {
		expect(resolveRange(0, { to: 4, inclusive: true, found: true })).toEqual({
			start: 0,
			end: 5,
		});
	});

	it("df, deletes exactly one more character than dt, for the same target", () => {
		// df, target found at index 3 (comma) -> inclusive
		const fRange = resolveRange(0, { to: 3, inclusive: true, found: true });
		// dt, uses the same raw target index but is exclusive
		const tRange = resolveRange(0, { to: 3, inclusive: false, found: true });
		expect(fRange.end - tRange.end).toBe(1);
	});

	it("handles a backward exclusive motion (e.g. 0 from mid-line)", () => {
		expect(resolveRange(6, { to: 0, inclusive: false, found: true })).toEqual({
			start: 0,
			end: 6,
		});
	});

	it("returns a text object's range as-is, ignoring `from` entirely", () => {
		// from=99 is nonsensical for this range but must be ignored when `range` is set.
		expect(
			resolveRange(99, {
				to: 0,
				inclusive: false,
				found: true,
				range: { start: 2, end: 5 },
			}),
		).toEqual({
			start: 2,
			end: 5,
		});
	});
});

function range(text: string, cursor: number, motion: Motion) {
	const result = resolveMotion(createBuffer(text, cursor), motion);
	return result.found ? result.range : undefined;
}

describe("resolveMotion: text objects - iw / aw", () => {
	it("iw on a word char selects the word run only", () => {
		expect(
			range("foo bar", 1, {
				type: "textObject",
				scope: "inner",
				target: "word",
			}),
		).toEqual({
			start: 0,
			end: 3,
		});
	});

	it("iw on a punctuation char selects the punctuation run", () => {
		expect(
			range("foo, bar", 3, {
				type: "textObject",
				scope: "inner",
				target: "word",
			}),
		).toEqual({
			start: 3,
			end: 4,
		});
	});

	it("iw on a whitespace char selects the whitespace run (Vim quirk)", () => {
		expect(
			range("a    b", 2, {
				type: "textObject",
				scope: "inner",
				target: "word",
			}),
		).toEqual({
			start: 1,
			end: 5,
		});
	});

	it("aw includes trailing whitespace when present", () => {
		expect(
			range("foo bar", 1, {
				type: "textObject",
				scope: "around",
				target: "word",
			}),
		).toEqual({
			start: 0,
			end: 4,
		});
	});

	it("aw falls back to leading whitespace when there is no trailing whitespace", () => {
		// "hello!" - "hello" has no trailing space (next char is punctuation),
		// but has a leading space.
		expect(
			range(" hello!", 1, {
				type: "textObject",
				scope: "around",
				target: "word",
			}),
		).toEqual({
			start: 0,
			end: 6,
		});
	});

	it("aw on whitespace selects the whitespace plus the following word", () => {
		expect(
			range("a    b", 2, {
				type: "textObject",
				scope: "around",
				target: "word",
			}),
		).toEqual({
			start: 1,
			end: 6,
		});
	});

	it("aw with no adjacent whitespace at all selects just the word", () => {
		expect(
			range("hello", 0, {
				type: "textObject",
				scope: "around",
				target: "word",
			}),
		).toEqual({
			start: 0,
			end: 5,
		});
	});
});

describe("resolveMotion: text objects - i\" / a\" (and i' / a')", () => {
	it("resolves when the cursor is inside a quote pair", () => {
		expect(
			range('say "hi" now', 5, {
				type: "textObject",
				scope: "inner",
				target: "doubleQuote",
			}),
		).toEqual({
			start: 5,
			end: 7,
		});
	});

	it("resolves when the cursor is ON the opening or closing quote", () => {
		const inner = {
			type: "textObject",
			scope: "inner",
			target: "doubleQuote",
		} as const;
		expect(range('say "hi" now', 4, inner)).toEqual({ start: 5, end: 7 });
		expect(range('say "hi" now', 7, inner)).toEqual({ start: 5, end: 7 });
	});

	it("forward-searches when the cursor is before the first quote on the line", () => {
		expect(
			range('  "hi" end', 0, {
				type: "textObject",
				scope: "inner",
				target: "doubleQuote",
			}),
		).toEqual({
			start: 3,
			end: 5,
		});
	});

	it("is not found when there are no quotes at all", () => {
		expect(
			resolveMotion(createBuffer("no quotes here", 0), {
				type: "textObject",
				scope: "inner",
				target: "doubleQuote",
			}).found,
		).toBe(false);
	});

	it("is not found when the cursor is past the only pair (not before-first-quote)", () => {
		expect(
			resolveMotion(createBuffer('"hi" end', 6), {
				type: "textObject",
				scope: "inner",
				target: "doubleQuote",
			}).found,
		).toBe(false);
	});

	it('a" includes whitespace right after the closing quote', () => {
		expect(
			range('say "hi" end', 5, {
				type: "textObject",
				scope: "around",
				target: "doubleQuote",
			}),
		).toEqual({
			start: 4,
			end: 9, // quotes + exactly the run of spaces, not further into "end"
		});
	});

	it('a" does not fall back to leading whitespace when there is no trailing whitespace', () => {
		expect(
			range('x"hi"y', 2, {
				type: "textObject",
				scope: "around",
				target: "doubleQuote",
			}),
		).toEqual({
			start: 1,
			end: 5,
		});
	});

	it("handles an empty quoted string (adjacent quotes)", () => {
		expect(
			range('a""b', 1, {
				type: "textObject",
				scope: "inner",
				target: "doubleQuote",
			}),
		).toEqual({
			start: 2,
			end: 2,
		});
	});

	it("single quotes work the same way, independently of double quotes", () => {
		expect(
			range("say 'hi' now", 5, {
				type: "textObject",
				scope: "inner",
				target: "singleQuote",
			}),
		).toEqual({
			start: 5,
			end: 7,
		});
	});
});

describe("resolveMotion: text objects - i) / a)", () => {
	it("resolves when the cursor is inside the parens", () => {
		expect(
			range("foo(bar)baz", 5, {
				type: "textObject",
				scope: "inner",
				target: "paren",
			}),
		).toEqual({
			start: 4,
			end: 7,
		});
	});

	it("resolves when the cursor is ON either paren character", () => {
		const inner = {
			type: "textObject",
			scope: "inner",
			target: "paren",
		} as const;
		expect(range("foo(bar)baz", 3, inner)).toEqual({ start: 4, end: 7 });
		expect(range("foo(bar)baz", 7, inner)).toEqual({ start: 4, end: 7 });
	});

	it("a) includes both paren characters", () => {
		expect(
			range("foo(bar)baz", 5, {
				type: "textObject",
				scope: "around",
				target: "paren",
			}),
		).toEqual({
			start: 3,
			end: 8,
		});
	});

	it("does NOT forward-search - a cursor outside the parens is not found", () => {
		expect(
			resolveMotion(createBuffer("foo(bar)baz", 0), {
				type: "textObject",
				scope: "inner",
				target: "paren",
			}).found,
		).toBe(false);
		expect(
			resolveMotion(createBuffer("foo(bar)baz", 9), {
				type: "textObject",
				scope: "inner",
				target: "paren",
			}).found,
		).toBe(false);
	});

	it("targets the innermost enclosing pair when parens are nested", () => {
		// indices: f0o1o2(3a4(5b6)7c8)9d10a11r12
		const text = "foo(a(b)c)dar";
		expect(
			range(text, 6, { type: "textObject", scope: "inner", target: "paren" }),
		).toEqual({
			start: 6,
			end: 7,
		});
		// cursor on 'c' (index 8): inside the outer pair but outside the inner one
		expect(
			range(text, 8, { type: "textObject", scope: "inner", target: "paren" }),
		).toEqual({
			start: 4,
			end: 9,
		});
	});

	it("an unmatched open paren is not found", () => {
		expect(
			resolveMotion(createBuffer("foo(bar", 5), {
				type: "textObject",
				scope: "inner",
				target: "paren",
			}).found,
		).toBe(false);
	});
});
