import { tokenizeKeys } from "./keys";
import type { Motion, TextObjectTarget } from "./motions";

// Grammar: [count] operator [count] motion (see CLAUDE.md), plus a bare
// [count] motion and [count] x. Phase names/shape follow CLAUDE.md's
// InputState sketch; count-carrying fields were added to each phase because
// the literal sketch has nowhere to hold count1 while count2 is being typed
// (needed for count1 * count2, e.g. "2d3w" = 6 words).
export type InputState =
	| { phase: "idle"; countBuffer: string }
	| {
			phase: "operatorPending";
			operator: "d" | "y" | "c";
			count1: number | undefined;
			countBuffer: string;
	  }
	| {
			phase: "charMotionPending";
			operator: "d" | "y" | "c" | null;
			count: number | undefined;
			motion: "f" | "t";
	  }
	// Text objects are only reachable from operatorPending (never bare/idle -
	// see parseIdle, which does not handle "i"/"a"), so `operator` is never null.
	| {
			phase: "textObjectPending";
			operator: "d" | "y" | "c";
			scope: "inner" | "around";
	  };

export type ParsedCommand =
	| { type: "motion"; motion: Motion; count?: number }
	| {
			type: "operatorMotion";
			operator: "d" | "c" | "y";
			count?: number;
			motion: Motion;
	  }
	| { type: "single"; command: "x"; count?: number };

export const initialInputState: InputState = { phase: "idle", countBuffer: "" };

export type ParseResult = { state: InputState; command: ParsedCommand | null };

type SimpleMotionKey = "h" | "l" | "0" | "$" | "w" | "e" | "b";
const SIMPLE_MOTION_KEYS: readonly SimpleMotionKey[] = [
	"h",
	"l",
	"0",
	"$",
	"w",
	"e",
	"b",
];

function isSimpleMotionKey(key: string): key is SimpleMotionKey {
	return (SIMPLE_MOTION_KEYS as readonly string[]).includes(key);
}

function simpleMotion(key: SimpleMotionKey): Motion {
	return { type: key };
}

function isDigit(key: string): boolean {
	return key.length === 1 && key >= "0" && key <= "9";
}

// "0" is a digit while a count is already being typed, and the go-to-column-0
// motion otherwise - the classic Vim quirk.
function isCountDigit(key: string, countBuffer: string): boolean {
	return isDigit(key) && !(key === "0" && countBuffer === "");
}

function parseCount(buffer: string): number | undefined {
	return buffer === "" ? undefined : Number.parseInt(buffer, 10);
}

function multiplyCounts(
	count1: number | undefined,
	count2: number | undefined,
): number | undefined {
	if (count1 === undefined && count2 === undefined) return undefined;
	return (count1 ?? 1) * (count2 ?? 1);
}

function textObjectTargetFromKey(key: string): TextObjectTarget | null {
	switch (key) {
		case "w":
			return "word";
		case '"':
			return "doubleQuote";
		case "'":
			return "singleQuote";
		case "(":
		case ")":
			return "paren";
		default:
			return null;
	}
}

export function parseKey(state: InputState, key: string): ParseResult {
	switch (state.phase) {
		case "idle":
			return parseIdle(state, key);
		case "operatorPending":
			return parseOperatorPending(state, key);
		case "charMotionPending":
			return parseCharMotionPending(state, key);
		case "textObjectPending":
			return parseTextObjectPending(state, key);
	}
}

function parseIdle(
	state: Extract<InputState, { phase: "idle" }>,
	key: string,
): ParseResult {
	if (isCountDigit(key, state.countBuffer)) {
		return {
			state: { phase: "idle", countBuffer: state.countBuffer + key },
			command: null,
		};
	}
	if (key === "x") {
		return {
			state: initialInputState,
			command: {
				type: "single",
				command: "x",
				count: parseCount(state.countBuffer),
			},
		};
	}
	if (key === "d" || key === "y" || key === "c") {
		return {
			state: {
				phase: "operatorPending",
				operator: key,
				count1: parseCount(state.countBuffer),
				countBuffer: "",
			},
			command: null,
		};
	}
	if (key === "f" || key === "t") {
		return {
			state: {
				phase: "charMotionPending",
				operator: null,
				count: parseCount(state.countBuffer),
				motion: key,
			},
			command: null,
		};
	}
	if (isSimpleMotionKey(key)) {
		return {
			state: initialInputState,
			command: {
				type: "motion",
				motion: simpleMotion(key),
				count: parseCount(state.countBuffer),
			},
		};
	}
	return { state: initialInputState, command: null };
}

function parseOperatorPending(
	state: Extract<InputState, { phase: "operatorPending" }>,
	key: string,
): ParseResult {
	if (isCountDigit(key, state.countBuffer)) {
		return {
			state: { ...state, countBuffer: state.countBuffer + key },
			command: null,
		};
	}
	if (key === "f" || key === "t") {
		return {
			state: {
				phase: "charMotionPending",
				operator: state.operator,
				count: multiplyCounts(state.count1, parseCount(state.countBuffer)),
				motion: key,
			},
			command: null,
		};
	}
	if (key === "i" || key === "a") {
		// Count + text object is out of scope (e.g. "2diw"): the whole command
		// fails to parse, same as if the key were never recognized.
		if (state.count1 !== undefined || state.countBuffer !== "") {
			return { state: initialInputState, command: null };
		}
		return {
			state: {
				phase: "textObjectPending",
				operator: state.operator,
				scope: key === "i" ? "inner" : "around",
			},
			command: null,
		};
	}
	if (isSimpleMotionKey(key)) {
		return {
			state: initialInputState,
			command: {
				type: "operatorMotion",
				operator: state.operator,
				motion: simpleMotion(key),
				count: multiplyCounts(state.count1, parseCount(state.countBuffer)),
			},
		};
	}
	// Unrecognized key (including a repeated operator, e.g. "dd" - linewise
	// delete is out of MVP scope) cancels the pending operator.
	return { state: initialInputState, command: null };
}

function parseTextObjectPending(
	state: Extract<InputState, { phase: "textObjectPending" }>,
	key: string,
): ParseResult {
	const target = textObjectTargetFromKey(key);
	if (target === null) {
		// Not a recognized text object target: cancel, same as any other
		// unrecognized key while a command is pending.
		return { state: initialInputState, command: null };
	}
	const motion: Motion = { type: "textObject", scope: state.scope, target };
	return {
		state: initialInputState,
		command: {
			type: "operatorMotion",
			operator: state.operator,
			motion,
			count: undefined,
		},
	};
}

function parseCharMotionPending(
	state: Extract<InputState, { phase: "charMotionPending" }>,
	key: string,
): ParseResult {
	// Any key is a valid f/t target character, including digits and punctuation.
	const motion: Motion = { type: state.motion, char: key };
	const command: ParsedCommand =
		state.operator === null
			? { type: "motion", motion, count: state.count }
			: {
					type: "operatorMotion",
					operator: state.operator,
					motion,
					count: state.count,
				};
	return { state: initialInputState, command };
}

// Drives the state machine over a full key sequence and collects every
// completed command in order. Used to derive a command breakdown from a
// challenge's examples[0] (see explain.ts), and mirrors how a real key
// sequence is consumed one character at a time.
export function parseCommands(keys: string): ParsedCommand[] {
	let state = initialInputState;
	const commands: ParsedCommand[] = [];
	for (const token of tokenizeKeys(keys)) {
		// The parser only understands single-character keys (see runKeys in
		// execute.ts) - a stray bracket-notation token (e.g. "<Esc>") here means
		// the caller passed Insert-mode text, which this function has no concept
		// of; skip it rather than feeding it in char-by-char.
		if (token.length !== 1) continue;
		const result = parseKey(state, token);
		state = result.state;
		if (result.command) {
			commands.push(result.command);
		}
	}
	return commands;
}
