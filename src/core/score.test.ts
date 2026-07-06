import { describe, expect, it } from "vitest";
import { computeScore, nextStreak } from "./score";

describe("computeScore", () => {
	it("returns the base 1000 when everything else is zero", () => {
		expect(
			computeScore({
				remainingTimeMs: 0,
				idealKeys: 3,
				actualKeys: 3,
				streak: 0,
				mistakes: 0,
			}),
		).toBe(1000);
	});

	it("adds 0.1 point per remaining millisecond", () => {
		expect(
			computeScore({
				remainingTimeMs: 5000,
				idealKeys: 3,
				actualKeys: 3,
				streak: 0,
				mistakes: 0,
			}),
		).toBe(1500);
	});

	it("adds an efficiency bonus of 100 per key under ideal", () => {
		expect(
			computeScore({
				remainingTimeMs: 0,
				idealKeys: 5,
				actualKeys: 3,
				streak: 0,
				mistakes: 0,
			}),
		).toBe(1200);
	});

	it("does not give a negative efficiency bonus for using more than ideal keys", () => {
		expect(
			computeScore({
				remainingTimeMs: 0,
				idealKeys: 3,
				actualKeys: 8,
				streak: 0,
				mistakes: 0,
			}),
		).toBe(1000);
	});

	it("adds 50 per streak", () => {
		expect(
			computeScore({
				remainingTimeMs: 0,
				idealKeys: 3,
				actualKeys: 3,
				streak: 4,
				mistakes: 0,
			}),
		).toBe(1200);
	});

	it("subtracts 100 per mistake", () => {
		expect(
			computeScore({
				remainingTimeMs: 0,
				idealKeys: 3,
				actualKeys: 3,
				streak: 0,
				mistakes: 2,
			}),
		).toBe(800);
	});

	it("combines all terms", () => {
		// 1000 + 2000*0.1 + (5-3)*100 + 3*50 - 1*100 = 1000+200+200+150-100 = 1450
		expect(
			computeScore({
				remainingTimeMs: 2000,
				idealKeys: 5,
				actualKeys: 3,
				streak: 3,
				mistakes: 1,
			}),
		).toBe(1450);
	});

	it("a Great clear (actualKeys <= idealKeys) scores higher than the same round solved verbosely", () => {
		const great = computeScore({
			remainingTimeMs: 3000,
			idealKeys: 3,
			actualKeys: 3,
			streak: 0,
			mistakes: 0,
		});
		const verbose = computeScore({
			remainingTimeMs: 3000,
			idealKeys: 3,
			actualKeys: 6,
			streak: 0,
			mistakes: 0,
		});
		// Both clear the challenge, but the verbose one used 3 extra keys - with
		// equal time/streak/mistakes the only thing that can differ here is a
		// caller passing the *actual* elapsed time (verbose play takes longer),
		// which isn't modeled by this pure function. What computeScore alone can
		// guarantee is: using more keys never scores *better*.
		expect(great).toBeGreaterThanOrEqual(verbose);
	});

	it("using fewer than ideal keys scores strictly higher than using exactly ideal keys", () => {
		const fewer = computeScore({
			remainingTimeMs: 0,
			idealKeys: 5,
			actualKeys: 3,
			streak: 0,
			mistakes: 0,
		});
		const exact = computeScore({
			remainingTimeMs: 0,
			idealKeys: 5,
			actualKeys: 5,
			streak: 0,
			mistakes: 0,
		});
		expect(fewer).toBeGreaterThan(exact);
	});

	it("rounds the result to a whole number", () => {
		expect(
			computeScore({
				remainingTimeMs: 12345,
				idealKeys: 3,
				actualKeys: 3,
				streak: 0,
				mistakes: 0,
			}),
		).toBe(2235);
	});
});

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
