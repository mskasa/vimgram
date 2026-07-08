import { describe, expect, it } from "vitest";
import { nextStreak } from "./streak";

describe("nextStreak", () => {
	it("increments on a great clear", () => {
		expect(nextStreak(2, "great")).toBe(3);
	});

	it("increments on a verbose clear too", () => {
		expect(nextStreak(2, "verbose")).toBe(3);
	});

	it("resets to 0 on timeout", () => {
		expect(nextStreak(5, "timeout")).toBe(0);
	});

	it("resets to 0 on giving up", () => {
		expect(nextStreak(5, "gaveUp")).toBe(0);
	});

	it("starts from 0", () => {
		expect(nextStreak(0, "great")).toBe(1);
	});
});
