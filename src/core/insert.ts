import type { BufferState } from "./buffer";
import { clampInsertCursor } from "./buffer";

// Pure Insert-mode editing functions. Callers (execute.ts's runKeys, or the
// app's key handler while buffer.mode === "insert") are responsible for
// routing keys here instead of through the (Normal-mode-only) parser.

export function insertChar(buffer: BufferState, char: string): BufferState {
	const text =
		buffer.text.slice(0, buffer.cursor) +
		char +
		buffer.text.slice(buffer.cursor);
	return {
		...buffer,
		text,
		cursor: clampInsertCursor(text, buffer.cursor + char.length),
	};
}

export function backspace(buffer: BufferState): BufferState {
	if (buffer.cursor === 0) return buffer;
	const text =
		buffer.text.slice(0, buffer.cursor - 1) + buffer.text.slice(buffer.cursor);
	return {
		...buffer,
		text,
		cursor: clampInsertCursor(text, buffer.cursor - 1),
	};
}

export function escapeInsert(buffer: BufferState): BufferState {
	// Leaving Insert mode moves the cursor one character left (clamped to 0),
	// same as real Vim - this also restores the Normal-mode "cursor is ON a
	// character" invariant, since Insert mode allows cursor === text.length.
	return { ...buffer, mode: "normal", cursor: Math.max(buffer.cursor - 1, 0) };
}
