import { describe, expect, it } from "vitest";
import { clampCursor, createBuffer, lastCharIndex } from "./buffer";

describe("lastCharIndex", () => {
	it("returns 0 for an empty string", () => {
		expect(lastCharIndex("")).toBe(0);
	});

	it("returns length - 1 for non-empty text", () => {
		expect(lastCharIndex("abc")).toBe(2);
	});

	it("returns 0 for a single-character string", () => {
		expect(lastCharIndex("a")).toBe(0);
	});
});

describe("clampCursor", () => {
	it("clamps negative positions to 0", () => {
		expect(clampCursor("abc", -1)).toBe(0);
	});

	it("clamps positions past the last character to lastCharIndex", () => {
		expect(clampCursor("abc", 99)).toBe(2);
	});

	it("leaves in-range positions unchanged", () => {
		expect(clampCursor("abc", 1)).toBe(1);
	});

	it("clamps to 0 for an empty string regardless of input", () => {
		expect(clampCursor("", 5)).toBe(0);
		expect(clampCursor("", -5)).toBe(0);
	});
});

describe("createBuffer", () => {
	it("defaults to cursor 0 and normal mode", () => {
		const buf = createBuffer("hello");
		expect(buf).toEqual({ text: "hello", cursor: 0, mode: "normal" });
	});

	it("clamps an out-of-range initial cursor", () => {
		const buf = createBuffer("hi", 99);
		expect(buf.cursor).toBe(1);
	});

	it("handles an empty buffer", () => {
		const buf = createBuffer("");
		expect(buf.cursor).toBe(0);
	});
});
