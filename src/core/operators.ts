import type { BufferState } from "./buffer";
import { clampCursor, clampInsertCursor } from "./buffer";

// Half-open [start, end) character range, already resolved from a motion
// (see motions.ts resolveRange) or computed directly (e.g. by `x`).
export type OperatorRange = { start: number; end: number };

export function applyDelete(
	buffer: BufferState,
	range: OperatorRange,
): BufferState {
	const newText =
		buffer.text.slice(0, range.start) + buffer.text.slice(range.end);
	return {
		...buffer,
		text: newText,
		cursor: clampCursor(newText, range.start),
	};
}

// Yank never changes `text`; the cursor moves to the start of the yanked
// range, matching Vim's behavior for charwise yanks in the non-edge case.
export function applyYank(
	buffer: BufferState,
	range: OperatorRange,
): BufferState {
	return {
		...buffer,
		yankRegister: buffer.text.slice(range.start, range.end),
		cursor: clampCursor(buffer.text, range.start),
	};
}

// Change deletes the range and enters Insert mode at its start. Unlike
// applyDelete, the cursor uses clampInsertCursor: Insert mode allows the
// cursor to sit right after the last character (e.g. after `c$`).
export function applyChange(
	buffer: BufferState,
	range: OperatorRange,
): BufferState {
	const newText =
		buffer.text.slice(0, range.start) + buffer.text.slice(range.end);
	return {
		...buffer,
		text: newText,
		mode: "insert",
		cursor: clampInsertCursor(newText, range.start),
	};
}
