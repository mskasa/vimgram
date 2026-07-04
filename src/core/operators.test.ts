import { describe, expect, it } from "vitest";
import { createBuffer } from "./buffer";
import { applyChange, applyDelete, applyYank } from "./operators";

describe("applyDelete", () => {
	it("removes the range and places the cursor at its start", () => {
		const buf = createBuffer("hello world", 0);
		const result = applyDelete(buf, { start: 0, end: 6 });
		expect(result.text).toBe("world");
		expect(result.cursor).toBe(0);
	});

	it("clamps the cursor when the deletion reaches the new end of line", () => {
		const buf = createBuffer("hello", 0);
		const result = applyDelete(buf, { start: 0, end: 5 });
		expect(result.text).toBe("");
		expect(result.cursor).toBe(0);
	});

	it("does not touch yankRegister", () => {
		const buf = { ...createBuffer("hello", 0), yankRegister: "prior" };
		const result = applyDelete(buf, { start: 0, end: 1 });
		expect(result.yankRegister).toBe("prior");
	});
});

describe("applyYank", () => {
	it("copies the range into yankRegister without changing text", () => {
		const buf = createBuffer("hello world", 0);
		const result = applyYank(buf, { start: 0, end: 5 });
		expect(result.yankRegister).toBe("hello");
		expect(result.text).toBe("hello world");
	});

	it("moves the cursor to the start of the yanked range", () => {
		const buf = createBuffer("hello world", 6);
		const result = applyYank(buf, { start: 6, end: 11 });
		expect(result.cursor).toBe(6);
	});
});

describe("applyChange", () => {
	it("removes the range and enters insert mode at its start", () => {
		const buf = createBuffer("hello world", 0);
		const result = applyChange(buf, { start: 0, end: 5 });
		expect(result.text).toBe(" world");
		expect(result.mode).toBe("insert");
		expect(result.cursor).toBe(0);
	});

	it("allows the cursor to sit right after the last character (unlike applyDelete)", () => {
		const buf = createBuffer("hello world", 6);
		const result = applyChange(buf, { start: 6, end: 11 });
		expect(result.text).toBe("hello ");
		expect(result.cursor).toBe(6);
		expect(result.mode).toBe("insert");
	});
});
