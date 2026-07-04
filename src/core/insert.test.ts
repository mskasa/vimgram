import { describe, expect, it } from "vitest";
import { backspace, escapeInsert, insertChar } from "./insert";

function insertBuffer(text: string, cursor: number) {
	return { text, cursor, mode: "insert" as const };
}

describe("insertChar", () => {
	it("inserts a character at the cursor and advances it", () => {
		const result = insertChar(insertBuffer("helloworld", 5), "_");
		expect(result.text).toBe("hello_world");
		expect(result.cursor).toBe(6);
	});

	it("can insert at the very end of the text (cursor === text.length)", () => {
		const result = insertChar(insertBuffer("hi", 2), "!");
		expect(result.text).toBe("hi!");
		expect(result.cursor).toBe(3);
	});

	it("can insert into an empty buffer", () => {
		const result = insertChar(insertBuffer("", 0), "x");
		expect(result.text).toBe("x");
		expect(result.cursor).toBe(1);
	});
});

describe("backspace", () => {
	it("removes the character before the cursor", () => {
		const result = backspace(insertBuffer("hello", 5));
		expect(result.text).toBe("hell");
		expect(result.cursor).toBe(4);
	});

	it("is a no-op at the start of the line", () => {
		const buf = insertBuffer("hello", 0);
		expect(backspace(buf)).toEqual(buf);
	});
});

describe("escapeInsert", () => {
	it("returns to normal mode and moves the cursor one left", () => {
		const result = escapeInsert(insertBuffer("hello", 5));
		expect(result.mode).toBe("normal");
		expect(result.cursor).toBe(4);
	});

	it("clamps to 0 instead of going negative", () => {
		const result = escapeInsert(insertBuffer("", 0));
		expect(result.cursor).toBe(0);
		expect(result.mode).toBe("normal");
	});
});
