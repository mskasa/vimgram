import { describe, expect, it } from "vitest";
import {
	type RoundPhase,
	resolveMenuKey,
	resolvePlayingKey,
	resolveResultKey,
	resolveSummaryKey,
	routeKeydown,
} from "./keymap";

describe("resolveMenuKey", () => {
	it.each([
		["h", "moveLeft"],
		["ArrowLeft", "moveLeft"],
		["l", "moveRight"],
		["ArrowRight", "moveRight"],
		["Enter", "select"],
		["?", "toggleHelp"],
	] as const)("maps %s to %s", (key, action) => {
		expect(resolveMenuKey({ key, hasModifier: false })).toBe(action);
	});

	it("ignores unmapped keys", () => {
		expect(resolveMenuKey({ key: "a", hasModifier: false })).toBeNull();
	});

	it("ignores every mapped key when a modifier is held", () => {
		expect(resolveMenuKey({ key: "h", hasModifier: true })).toBeNull();
		expect(resolveMenuKey({ key: "Enter", hasModifier: true })).toBeNull();
	});
});

describe("resolvePlayingKey", () => {
	it.each(["s", "S"] as const)("maps %s to skip", (key) => {
		expect(resolvePlayingKey({ key, hasModifier: false })).toBe("skip");
	});

	it("maps ? to giveUp", () => {
		expect(resolvePlayingKey({ key: "?", hasModifier: false })).toBe("giveUp");
	});

	it("ignores unmapped keys", () => {
		expect(resolvePlayingKey({ key: "d", hasModifier: false })).toBeNull();
	});

	it("ignores mapped keys when a modifier is held", () => {
		expect(resolvePlayingKey({ key: "s", hasModifier: true })).toBeNull();
		expect(resolvePlayingKey({ key: "?", hasModifier: true })).toBeNull();
	});
});

describe("resolveResultKey", () => {
	it.each([
		["Enter", "next"],
		["r", "retry"],
		["R", "retry"],
		["Escape", "exitToMenu"],
	] as const)("maps %s to %s", (key, action) => {
		expect(resolveResultKey({ key, hasModifier: false })).toBe(action);
	});

	it("ignores unmapped keys", () => {
		expect(resolveResultKey({ key: "x", hasModifier: false })).toBeNull();
	});

	it("ignores every mapped key when a modifier is held (e.g. Cmd+R reload)", () => {
		expect(resolveResultKey({ key: "r", hasModifier: true })).toBeNull();
		expect(resolveResultKey({ key: "Enter", hasModifier: true })).toBeNull();
		expect(resolveResultKey({ key: "Escape", hasModifier: true })).toBeNull();
	});
});

describe("resolveSummaryKey", () => {
	it.each([
		["Enter", "backToMenu"],
		["r", "replay"],
		["R", "replay"],
	] as const)("maps %s to %s", (key, action) => {
		expect(resolveSummaryKey({ key, hasModifier: false })).toBe(action);
	});

	it("ignores unmapped keys", () => {
		expect(resolveSummaryKey({ key: "Escape", hasModifier: false })).toBeNull();
	});

	it("ignores every mapped key when a modifier is held", () => {
		expect(resolveSummaryKey({ key: "r", hasModifier: true })).toBeNull();
		expect(resolveSummaryKey({ key: "Enter", hasModifier: true })).toBeNull();
	});
});

describe("routeKeydown", () => {
	it("routes to command entry while playing", () => {
		expect(routeKeydown("playing", { key: "d", hasModifier: false })).toEqual({
			target: "command",
		});
	});

	it("routes an unmapped key during result to ignored, not command entry", () => {
		expect(routeKeydown("result", { key: "x", hasModifier: false })).toEqual({
			target: "ignored",
		});
	});

	it("routes Enter to the result action once the phase is result", () => {
		expect(
			routeKeydown("result", { key: "Enter", hasModifier: false }),
		).toEqual({ target: "result", action: "next" });
	});

	it("ignores modifier-held keys in both phases", () => {
		expect(routeKeydown("playing", { key: "r", hasModifier: true })).toEqual({
			target: "ignored",
		});
		expect(routeKeydown("result", { key: "r", hasModifier: true })).toEqual({
			target: "ignored",
		});
	});

	it("reflects the phase read at call time, not an earlier snapshot - the guarantee behind mashing Enter the instant a round ends", () => {
		// Simulates a ref whose `.current` is mutated between two synchronous
		// keydown calls, exactly like resultRef in LevelRound.tsx: the handler
		// invoked for the SECOND keystroke must see the already-updated phase,
		// not a decision baked in when the listener was first attached.
		const phaseRef = { current: "playing" as RoundPhase };
		const handle = (input: { key: string; hasModifier: boolean }) =>
			routeKeydown(phaseRef.current, input);

		// First keystroke completes the challenge - phase flips synchronously,
		// exactly as endRound's setResult call does (see LevelRound.tsx).
		const first = handle({ key: "w", hasModifier: false });
		phaseRef.current = "result";
		// Second keystroke (Enter), fired immediately after with no delay.
		const second = handle({ key: "Enter", hasModifier: false });

		expect(first).toEqual({ target: "command" });
		expect(second).toEqual({ target: "result", action: "next" });
	});
});
