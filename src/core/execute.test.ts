import { describe, expect, it } from "vitest";
import { createBuffer } from "./buffer";
import { runKeys } from "./execute";

describe("x", () => {
	it("deletes the character under the cursor", () => {
		const result = runKeys(createBuffer("abc", 0), "x");
		expect(result.text).toBe("bc");
		expect(result.cursor).toBe(0);
	});

	it("3x deletes 3 characters and clamps the cursor", () => {
		const result = runKeys(createBuffer("abcde", 1), "3x");
		expect(result.text).toBe("ae");
		expect(result.cursor).toBe(1);
	});

	it("is a no-op on an empty buffer", () => {
		const result = runKeys(createBuffer(""), "x");
		expect(result.text).toBe("");
		expect(result.cursor).toBe(0);
	});
});

describe("d + motion", () => {
	it("dw deletes the word and its trailing whitespace", () => {
		const result = runKeys(createBuffer("hello world", 0), "dw");
		expect(result.text).toBe("world");
		expect(result.cursor).toBe(0);
	});

	it("de deletes through the end of the word, keeping trailing whitespace", () => {
		const result = runKeys(createBuffer("hello world", 0), "de");
		expect(result.text).toBe(" world");
		expect(result.cursor).toBe(0);
	});

	it("d$ deletes to end of line and clamps the cursor to the new last char", () => {
		const result = runKeys(createBuffer("hello world", 6), "d$");
		expect(result.text).toBe("hello ");
		expect(result.cursor).toBe(5);
	});

	it("df, deletes through the found character (inclusive)", () => {
		const result = runKeys(createBuffer("a,b", 0), "df,");
		expect(result.text).toBe("b");
		expect(result.cursor).toBe(0);
	});

	it("dt, deletes up to but not including the found character (exclusive)", () => {
		const result = runKeys(createBuffer("a,b", 0), "dt,");
		expect(result.text).toBe(",b");
		expect(result.cursor).toBe(0);
	});

	it("df, deletes exactly one more character than dt, for the same target", () => {
		const dfResult = runKeys(createBuffer("xa,b", 0), "df,");
		const dtResult = runKeys(createBuffer("xa,b", 0), "dt,");
		expect(dfResult.text.length).toBe(dtResult.text.length - 1);
	});
});

describe("y + motion", () => {
	it("yw copies without changing the text", () => {
		const result = runKeys(createBuffer("hello world", 0), "yw");
		expect(result.text).toBe("hello world");
		expect(result.yankRegister).toBe("hello ");
	});

	it('yf" yanks through the found character (inclusive)', () => {
		const result = runKeys(createBuffer('say "hi"', 0), 'yf"');
		expect(result.text).toBe('say "hi"');
		expect(result.yankRegister).toBe('say "');
	});

	it("moves the cursor to the start of the yanked range", () => {
		const result = runKeys(createBuffer("hello world", 6), "y$");
		expect(result.cursor).toBe(6);
	});
});

describe("f/t not found: whole command fails, no partial execution", () => {
	it("dfz leaves the buffer completely unchanged when z is absent", () => {
		const initial = createBuffer("abc", 0);
		const result = runKeys(initial, "dfz");
		expect(result).toEqual(initial);
	});

	it("a bare fz with no match does not move the cursor", () => {
		const initial = createBuffer("abc", 0);
		const result = runKeys(initial, "fz");
		expect(result.cursor).toBe(0);
	});
});

describe("count multiplication end-to-end", () => {
	it("2d3w deletes 6 words (count1 * count2)", () => {
		const text = "one two three four five six seven";
		const result = runKeys(createBuffer(text, 0), "2d3w");
		expect(result.text).toBe("seven");
		expect(result.cursor).toBe(0);
	});

	it("3l repeated stops at the last character instead of erroring", () => {
		const result = runKeys(createBuffer("ab", 0), "3l");
		expect(result.cursor).toBe(1);
	});
});

describe("c + motion (change): the cw-acts-like-ce quirk", () => {
	it("cw does NOT swallow the trailing whitespace, unlike dw", () => {
		const cw = runKeys(createBuffer("hello world", 0), "cw");
		const dw = runKeys(createBuffer("hello world", 0), "dw");
		expect(cw.text).toBe(" world"); // space preserved
		expect(dw.text).toBe("world"); // space consumed
		expect(cw.mode).toBe("insert");
		expect(dw.mode).toBe("normal");
	});

	it("cw on a whitespace character behaves like plain dw (no special case)", () => {
		const result = runKeys(createBuffer(" hello", 0), "cw");
		expect(result.text).toBe("hello");
		expect(result.mode).toBe("insert");
	});

	it("the cw substitution applies once regardless of count (c2w behaves like c2e)", () => {
		const c2w = runKeys(createBuffer("one two three four", 0), "c2w");
		const c2e = runKeys(createBuffer("one two three four", 0), "c2e");
		expect(c2w.text).toBe(c2e.text);
		expect(c2w.text).toBe(" three four");
	});

	it("ce also excludes trailing whitespace (no special case needed - it's inherent)", () => {
		const result = runKeys(createBuffer("hello world", 0), "ce");
		expect(result.text).toBe(" world");
		expect(result.mode).toBe("insert");
	});

	it("c$ changes to end of line, entering insert right after the deleted range", () => {
		const result = runKeys(createBuffer("hello world", 6), "c$");
		expect(result.text).toBe("hello ");
		expect(result.cursor).toBe(6); // insert-mode bound, NOT clamped to lastCharIndex
		expect(result.mode).toBe("insert");
	});

	it('ct" deletes exclusive of the quote, one fewer character than cf"', () => {
		const ct = runKeys(createBuffer('say "hi"', 0), 'ct"');
		const cf = runKeys(createBuffer('say "hi"', 0), 'cf"');
		expect(ct.text.length).toBe(cf.text.length + 1);
		expect(ct.mode).toBe("insert");
	});
});

describe("full round trips through Insert mode via runKeys", () => {
	it("cwgoodbye<Esc> replaces the first word and returns to normal mode", () => {
		const result = runKeys(createBuffer("hello world", 0), "cwgoodbye<Esc>");
		expect(result.text).toBe("goodbye world");
		expect(result.mode).toBe("normal");
	});

	it('ct"jiro<Esc> renames taro to jiro inside quotes', () => {
		const result = runKeys(createBuffer('let x = "taro";', 9), 'ct"jiro<Esc>');
		expect(result.text).toBe('let x = "jiro";');
		expect(result.mode).toBe("normal");
	});

	it("<BS> during insert removes the just-typed character", () => {
		const result = runKeys(
			createBuffer("hello world", 0),
			"cwgoodbye<BS><BS><Esc>",
		);
		expect(result.text).toBe("goodb world");
		expect(result.mode).toBe("normal");
	});

	it("insert mode allows appending past the end of the original text (c$)", () => {
		const result = runKeys(createBuffer("total = wrong", 8), "c$42<Esc>");
		expect(result.text).toBe("total = 42");
		expect(result.mode).toBe("normal");
	});
});

describe("text objects combined with d / y / c", () => {
	it("diw deletes just the word under the cursor", () => {
		const result = runKeys(createBuffer("foo bar baz", 4), "diw");
		expect(result.text).toBe("foo  baz");
		expect(result.mode).toBe("normal");
	});

	it("daw deletes the word and its surrounding space (unlike diw)", () => {
		const result = runKeys(createBuffer("foo bar baz", 4), "daw");
		expect(result.text).toBe("foo baz");
		expect(result.mode).toBe("normal");
	});

	it('yi" yanks the quoted text without changing it', () => {
		const result = runKeys(createBuffer('say "hi" now', 5), 'yi"');
		expect(result.text).toBe('say "hi" now');
		expect(result.yankRegister).toBe("hi");
	});

	it("di) and da) differ by the parens themselves", () => {
		const inner = runKeys(createBuffer("foo(bar)baz", 5), "di)");
		const around = runKeys(createBuffer("foo(bar)baz", 5), "da)");
		expect(inner.text).toBe("foo()baz");
		expect(around.text).toBe("foobaz");
	});

	it("di( and di) are equivalent (either paren char is accepted)", () => {
		const viaOpen = runKeys(createBuffer("foo(bar)baz", 5), "di(");
		const viaClose = runKeys(createBuffer("foo(bar)baz", 5), "di)");
		expect(viaOpen).toEqual(viaClose);
	});

	it("a text object that fails to resolve leaves the buffer completely unchanged", () => {
		const initial = createBuffer("no quotes here", 0);
		const result = runKeys(initial, 'di"');
		expect(result).toEqual(initial);
	});

	it('ci"jiro<Esc> deletes the quoted text and types a replacement', () => {
		const result = runKeys(createBuffer('let x = "taro";', 9), 'ci"jiro<Esc>');
		expect(result.text).toBe('let x = "jiro";');
		expect(result.mode).toBe("normal");
	});

	it("ciw enters Insert mode at the start of the deleted word", () => {
		const result = runKeys(createBuffer("hello world", 0), "ciw");
		expect(result.text).toBe(" world");
		expect(result.mode).toBe("insert");
		expect(result.cursor).toBe(0);
	});
});
