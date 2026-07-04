import type { BufferState } from "./buffer";
import { clampCursor } from "./buffer";
import { backspace, escapeInsert, insertChar } from "./insert";
import { tokenizeKeys } from "./keys";
import {
	isBlank,
	type Motion,
	type MotionResult,
	resolveMotion,
	resolveRange,
} from "./motions";
import { applyChange, applyDelete, applyYank } from "./operators";
import type { ParsedCommand } from "./parser";
import { initialInputState, parseKey } from "./parser";

// Applies a fully parsed command to a buffer, returning a new BufferState.
// Orchestrates motions.ts (range resolution) + operators.ts (range application).
// Only valid while buffer.mode === "normal" - the parser that produces
// ParsedCommand is itself Normal-mode-only (see parser.ts).
export function execute(
	buffer: BufferState,
	command: ParsedCommand,
): BufferState {
	switch (command.type) {
		case "motion":
			return executeBareMotion(buffer, command.motion, command.count ?? 1);
		case "single":
			return executeX(buffer, command.count ?? 1);
		case "operatorMotion":
			return executeOperatorMotion(
				buffer,
				command.operator,
				command.motion,
				command.count ?? 1,
			);
	}
}

// Repeats a motion `count` times, chaining the cursor forward each step.
// Stops immediately (without partial progress) the moment a step's target
// isn't found - the whole command must fail, never partially execute.
function resolveRepeated(
	buffer: BufferState,
	motion: Motion,
	count: number,
): MotionResult {
	let cursor = buffer.cursor;
	let result = resolveMotion({ ...buffer, cursor }, motion);
	for (let i = 1; i < count && result.found; i++) {
		cursor = result.to;
		result = resolveMotion({ ...buffer, cursor }, motion);
	}
	return result;
}

function executeBareMotion(
	buffer: BufferState,
	motion: Motion,
	count: number,
): BufferState {
	const result = resolveRepeated(buffer, motion, count);
	if (!result.found) return buffer;
	// resolveMotion's `to` for "t" is the raw target index (see motions.ts);
	// a bare cursor move must land one character short of that.
	const landing = motion.type === "t" ? result.to - 1 : result.to;
	return { ...buffer, cursor: clampCursor(buffer.text, landing) };
}

function executeX(buffer: BufferState, count: number): BufferState {
	if (buffer.text.length === 0) return buffer;
	const start = buffer.cursor;
	const end = Math.min(buffer.text.length, start + count);
	return applyDelete(buffer, { start, end });
}

function executeOperatorMotion(
	buffer: BufferState,
	operator: "d" | "c" | "y",
	motion: Motion,
	count: number,
): BufferState {
	// Vim special case: "cw"/"cW" on a non-blank character behaves like "ce" -
	// it does not swallow the whitespace after the word, unlike plain "dw".
	// The substitution happens once regardless of count (so "c2w" == "c2e").
	const effectiveMotion: Motion =
		operator === "c" &&
		motion.type === "w" &&
		!isBlank(buffer.text, buffer.cursor)
			? { type: "e" }
			: motion;

	const result = resolveRepeated(buffer, effectiveMotion, count);
	if (!result.found) return buffer;
	const range = resolveRange(buffer.cursor, result);
	if (operator === "d") return applyDelete(buffer, range);
	if (operator === "y") return applyYank(buffer, range);
	return applyChange(buffer, range);
}

// Drives a whole normalized key sequence (see keys.ts) across both Normal
// and Insert mode, routing each token to the parser+execute (Normal) or
// insert.ts (Insert) depending on the buffer's current mode. This is the
// single source of truth for "what does typing this sequence do", used by
// challenge validation, tests, and (conceptually) mirrored by the app's live
// key handler.
export function runKeys(initial: BufferState, keys: string): BufferState {
	let buffer = initial;
	let inputState = initialInputState;

	for (const token of tokenizeKeys(keys)) {
		if (buffer.mode === "insert") {
			if (token === "<Esc>") {
				buffer = escapeInsert(buffer);
			} else if (token === "<BS>") {
				buffer = backspace(buffer);
			} else if (token.length === 1) {
				buffer = insertChar(buffer, token);
			}
			// Any other special token while inserting is ignored.
			continue;
		}

		// Normal mode: the parser only understands single-character keys.
		if (token.length !== 1) continue;
		const parsed = parseKey(inputState, token);
		inputState = parsed.state;
		if (parsed.command) {
			buffer = execute(buffer, parsed.command);
		}
	}

	return buffer;
}
