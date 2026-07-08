import { describe, expect, it } from "vitest";
import { findNextInDirection, type Rect } from "./gridNav";

// 4 level cards in one row (well-separated x-centers: 100/340/580/820),
// 2 review cards in a second row below (x-centers: 210/710) - mirrors the
// menu's actual layout at a wide viewport (see MenuScreen.tsx).
const FOUR_COLUMN_RECTS: Rect[] = [
	{ left: 0, right: 200, top: 0, bottom: 100 }, // 0: level1, cx=100
	{ left: 240, right: 440, top: 0, bottom: 100 }, // 1: level2, cx=340
	{ left: 480, right: 680, top: 0, bottom: 100 }, // 2: level3, cx=580
	{ left: 720, right: 920, top: 0, bottom: 100 }, // 3: level4, cx=820
	{ left: 0, right: 420, top: 120, bottom: 220 }, // 4: uncleared, cx=210
	{ left: 480, right: 940, top: 120, bottom: 220 }, // 5: notGreat, cx=710
];
const ALL_SELECTABLE = [true, true, true, true, true, true];

describe("findNextInDirection - 4 column layout", () => {
	it("moves down from a level card to the horizontally-nearest card in the row below", () => {
		expect(
			findNextInDirection(FOUR_COLUMN_RECTS, ALL_SELECTABLE, 0, "down"),
		).toBe(4);
		expect(
			findNextInDirection(FOUR_COLUMN_RECTS, ALL_SELECTABLE, 3, "down"),
		).toBe(5);
	});

	it("moves up from a review card to the horizontally-nearest level card", () => {
		expect(
			findNextInDirection(FOUR_COLUMN_RECTS, ALL_SELECTABLE, 4, "up"),
		).toBe(0);
		expect(
			findNextInDirection(FOUR_COLUMN_RECTS, ALL_SELECTABLE, 5, "up"),
		).toBe(3);
	});

	it("does not move down from the bottom row (nothing below)", () => {
		expect(
			findNextInDirection(FOUR_COLUMN_RECTS, ALL_SELECTABLE, 4, "down"),
		).toBe(4);
	});

	it("skips a non-selectable (0-count) review card and lands on the other one", () => {
		const selectable = [true, true, true, true, false, true];
		expect(findNextInDirection(FOUR_COLUMN_RECTS, selectable, 0, "down")).toBe(
			5,
		);
	});

	it("stays put when every candidate below is non-selectable", () => {
		const selectable = [true, true, true, true, false, false];
		expect(findNextInDirection(FOUR_COLUMN_RECTS, selectable, 0, "down")).toBe(
			0,
		);
	});
});

describe("findNextInDirection - 2 column layout (level cards wrap)", () => {
	// Level cards wrap into two rows of two; the review row sits below both.
	const rects: Rect[] = [
		{ left: 0, right: 300, top: 0, bottom: 100 }, // 0: level1, cx=150
		{ left: 320, right: 620, top: 0, bottom: 100 }, // 1: level2, cx=470
		{ left: 0, right: 300, top: 120, bottom: 220 }, // 2: level3, cx=150
		{ left: 320, right: 620, top: 120, bottom: 220 }, // 3: level4, cx=470
		{ left: 0, right: 300, top: 240, bottom: 340 }, // 4: uncleared, cx=150
		{ left: 320, right: 620, top: 240, bottom: 340 }, // 5: notGreat, cx=470
	];
	const selectable = [true, true, true, true, true, true];

	it("moves to the immediately adjacent row, not straight to a farther row sharing the same column", () => {
		// index 4 (row below) and index 2 (row directly below) both have the
		// same x-center as index 0 - the nearer ROW must win even though the
		// horizontal distance is tied.
		expect(findNextInDirection(rects, selectable, 0, "down")).toBe(2);
		expect(findNextInDirection(rects, selectable, 2, "down")).toBe(4);
	});

	it("picks the horizontally-nearest card when moving up into a wrapped row", () => {
		expect(findNextInDirection(rects, selectable, 5, "up")).toBe(3);
	});
});

describe("findNextInDirection - 1 column layout (everything stacked)", () => {
	const rects: Rect[] = Array.from({ length: 6 }, (_, i) => ({
		left: 0,
		right: 600,
		top: i * 120,
		bottom: i * 120 + 100,
	}));
	const selectable = [true, true, true, true, true, true];

	it("moves exactly one item at a time in either direction", () => {
		expect(findNextInDirection(rects, selectable, 0, "down")).toBe(1);
		expect(findNextInDirection(rects, selectable, 2, "down")).toBe(3);
		expect(findNextInDirection(rects, selectable, 5, "up")).toBe(4);
	});
});

describe("findNextInDirection - edge cases", () => {
	it("returns the current index unchanged when its rect is missing", () => {
		expect(findNextInDirection([], [], 0, "down")).toBe(0);
	});
});
