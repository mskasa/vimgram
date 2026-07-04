export type Mode = "normal" | "insert";

export type BufferState = {
	text: string;
	cursor: number;
	mode: Mode;
	yankRegister?: string;
};

// The cursor sits ON a character, not between characters, so its valid range
// is [0, lastCharIndex(text)] even for an empty buffer (cursor stays at 0).
export function lastCharIndex(text: string): number {
	return Math.max(0, text.length - 1);
}

export function clampCursor(text: string, cursor: number): number {
	return Math.min(Math.max(cursor, 0), lastCharIndex(text));
}

// Insert mode's cursor sits BETWEEN characters, so it may legally reach
// text.length (right after the last character, e.g. when appending) - one
// past clampCursor's normal-mode bound. Only src/core/insert.ts should need this.
export function clampInsertCursor(text: string, cursor: number): number {
	return Math.min(Math.max(cursor, 0), text.length);
}

export function createBuffer(
	text: string,
	cursor = 0,
	mode: Mode = "normal",
): BufferState {
	return { text, cursor: clampCursor(text, cursor), mode };
}
