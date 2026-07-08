// Every screen's key -> action mapping lives here, in one place, so "which
// screen owns which keys" (see CLAUDE.md "UI 操作") can be audited without
// hunting through each screen component. These are pure key->action lookups
// (no DOM types) so they're unit-testable without a browser/jsdom - the app
// layer extracts { key, hasModifier } from a real KeyboardEvent and calls in.
export type KeyInput = { key: string; hasModifier: boolean };

export type MenuKeyAction =
	| "moveLeft"
	| "moveRight"
	| "moveDown"
	| "moveUp"
	| "select"
	| "toggleHelp";

// h/l move through the menu's flat selectable sequence in logical (reading)
// order - level cards, then review entries - regardless of how auto-fit
// wraps them visually. j/k instead move geometrically (see
// core/gridNav.ts's findNextInDirection): the grid's column count isn't
// fixed, so "down"/"up" can't be a simple index math like h/l's is.
export function resolveMenuKey({
	key,
	hasModifier,
}: KeyInput): MenuKeyAction | null {
	if (hasModifier) return null;
	if (key === "h" || key === "ArrowLeft") return "moveLeft";
	if (key === "l" || key === "ArrowRight") return "moveRight";
	if (key === "j" || key === "ArrowDown") return "moveDown";
	if (key === "k" || key === "ArrowUp") return "moveUp";
	if (key === "Enter") return "select";
	if (key === "?") return "toggleHelp";
	return null;
}

export type ResultKeyAction = "next" | "retry" | "exitToMenu" | "playground";

// Only consulted while a round's result is showing (see LevelRound.tsx) -
// during play, Esc keeps its existing Normal/Insert-mode meaning and is
// never routed here, so it can't be mistaken for "back to menu" mid-command.
// "p" opens the Playground seeded with this challenge's initial text - safe
// to use here (unlike in resolvePlayingKey) since the result screen never
// forwards keys to the Vim engine, so there's no "p" (paste) collision risk.
export function resolveResultKey({
	key,
	hasModifier,
}: KeyInput): ResultKeyAction | null {
	if (hasModifier) return null;
	if (key === "Enter") return "next";
	if (key === "r" || key === "R") return "retry";
	if (key === "Escape") return "exitToMenu";
	if (key === "p" || key === "P") return "playground";
	return null;
}

export type PlayingKeyAction = "skip" | "giveUp" | "retry" | "back";

// Only meaningful in Normal mode, and only while no operator/f/t/text-object
// is pending (see LevelRound.tsx, which checks buffer.mode and
// inputState.phase === "idle" before calling this). None of these is used by
// any Vim command in this subset while idle, but "s"/"?"/"r" ARE valid f/t
// *target characters* (e.g. "f?" searches for a literal "?") - gating on the
// idle phase means a player mid-motion still gets the real Vim behavior, and
// in Insert mode none of these is consulted at all (typed as literal text).
// "r" doubles as "retry" here (not just on the result screen, see
// resolveResultKey) so a mid-play mistake can be cleared without waiting for
// a timeout or judge() to end the round. "[" is "go back to the previous
// challenge" (e.g. to undo an accidental skip) - chosen over "p" because "p"
// (paste) is an explicitly-listed future Vim feature in CLAUDE.md's スコープ外,
// while bracket motions are not, making "[" the safer long-term choice.
export function resolvePlayingKey({
	key,
	hasModifier,
}: KeyInput): PlayingKeyAction | null {
	if (hasModifier) return null;
	if (key === "s" || key === "S") return "skip";
	if (key === "?") return "giveUp";
	if (key === "r" || key === "R") return "retry";
	if (key === "[") return "back";
	return null;
}

export type SummaryKeyAction = "backToMenu" | "replay";

export function resolveSummaryKey({
	key,
	hasModifier,
}: KeyInput): SummaryKeyAction | null {
	if (hasModifier) return null;
	if (key === "Enter") return "backToMenu";
	if (key === "r" || key === "R") return "replay";
	return null;
}

export type RoundPhase = "playing" | "result";

export type KeydownRouting =
	| { target: "result"; action: ResultKeyAction }
	| { target: "command" }
	| { target: "ignored" };

// The single source of truth for "does this keydown belong to result
// navigation or to Normal/Insert-mode command entry", given the round's
// CURRENT phase. `phase` is a plain argument (not read from component state
// directly) so the one keydown listener that lives for a whole challenge's
// lifetime (see LevelRound.tsx) can pass in a ref's *current* value at call
// time - phase is decided per-keystroke, not fixed when the listener was
// attached. That's what makes mashing Enter the instant a round ends safe:
// there's no listener-swap gap for a fast keystroke to fall into.
export function routeKeydown(
	phase: RoundPhase,
	input: KeyInput,
): KeydownRouting {
	if (input.hasModifier) return { target: "ignored" };
	if (phase === "result") {
		const action = resolveResultKey(input);
		return action ? { target: "result", action } : { target: "ignored" };
	}
	return { target: "command" };
}
