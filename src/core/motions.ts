import type { BufferState } from "./buffer";
import { clampCursor, lastCharIndex } from "./buffer";

export type TextObjectTarget = "word" | "doubleQuote" | "singleQuote" | "paren";

export type Motion =
	| { type: "h" }
	| { type: "l" }
	| { type: "0" }
	| { type: "$" }
	| { type: "w" }
	| { type: "e" }
	| { type: "b" }
	| { type: "f"; char: string }
	| { type: "t"; char: string }
	| { type: "textObject"; scope: "inner" | "around"; target: TextObjectTarget };

export type MotionResult = {
	// Reference position used for operator-range math (see resolveRange below).
	// For f AND t this is the raw index of the found character - t does not
	// pre-subtract 1 here, see the "t" case below for why. Ignored (and
	// meaningless) when `range` is set.
	to: number;
	inclusive: boolean;
	// False when the target isn't found: for f/t, the character isn't present
	// forward of the cursor; for a text object, there's no enclosing/matching
	// word, quote pair, or paren pair. Callers must treat a not-found result
	// as "the whole command fails", never partially executing.
	found: boolean;
	// Set only by text objects, which resolve a full [start, end) span
	// directly rather than a directional (from, to, inclusive) triple -
	// their range doesn't necessarily start or end at the cursor.
	range?: { start: number; end: number };
};

// Computes the half-open [start, end) range an operator should act on, given
// the motion's origin cursor and its MotionResult.
export function resolveRange(
	from: number,
	result: MotionResult,
): { start: number; end: number } {
	if (result.range) return result.range;
	const start = Math.min(from, result.to);
	const end = result.inclusive
		? Math.max(from, result.to) + 1
		: Math.max(from, result.to);
	return { start, end };
}

type CharClass = "space" | "word" | "punct";

function classify(ch: string | undefined): CharClass {
	if (ch === undefined || /\s/.test(ch)) return "space";
	if (/[A-Za-z0-9_]/.test(ch)) return "word";
	return "punct";
}

// Whether the character at `cursor` is whitespace (or past the end of the
// line). Used by execute.ts for the "cw acts like ce" Vim special case.
export function isBlank(text: string, cursor: number): boolean {
	return classify(text[cursor]) === "space";
}

// `hitEnd` is true when the scan ran off the end of the text rather than
// landing on an actual next word - i.e. there is no next word, only the
// buffer boundary. See resolveMotion's "w" case for why this matters.
function wordForward(
	text: string,
	cursor: number,
): { to: number; hitEnd: boolean } {
	const len = text.length;
	if (len === 0) return { to: 0, hitEnd: true };
	let i = cursor;
	const startClass = classify(text[i]);
	if (startClass !== "space") {
		while (i < len && classify(text[i]) === startClass) i++;
	}
	while (i < len && classify(text[i]) === "space") i++;
	return i >= len
		? { to: lastCharIndex(text), hitEnd: true }
		: { to: i, hitEnd: false };
}

function wordEnd(text: string, cursor: number): number {
	const len = text.length;
	if (len === 0) return 0;
	let i = cursor + 1;
	while (i < len && classify(text[i]) === "space") i++;
	if (i >= len) return lastCharIndex(text);
	const cls = classify(text[i]);
	while (i + 1 < len && classify(text[i + 1]) === cls) i++;
	return i;
}

function wordBackward(text: string, cursor: number): number {
	let i = cursor - 1;
	while (i >= 0 && classify(text[i]) === "space") i--;
	if (i < 0) return 0;
	const cls = classify(text[i]);
	while (i - 1 >= 0 && classify(text[i - 1]) === cls) i--;
	return i;
}

function findForward(
	text: string,
	cursor: number,
	char: string,
): number | null {
	const index = text.indexOf(char, cursor + 1);
	return index === -1 ? null : index;
}

// Returns the [start, end) run of class `cls` containing `cursor`. Assumes
// classify(text[cursor]) === cls.
function findRun(
	text: string,
	cursor: number,
	cls: CharClass,
): { start: number; end: number } {
	let start = cursor;
	while (start > 0 && classify(text[start - 1]) === cls) start--;
	let end = cursor + 1;
	while (end < text.length && classify(text[end]) === cls) end++;
	return { start, end };
}

function resolveWordObject(
	text: string,
	cursor: number,
	scope: "inner" | "around",
): MotionResult {
	const notFound: MotionResult = { found: false, to: 0, inclusive: false };
	if (text.length === 0) return notFound;

	const cls = classify(text[cursor]);
	const wordRun = findRun(text, cursor, cls);

	if (scope === "inner") {
		return { found: true, to: 0, inclusive: false, range: wordRun };
	}

	// scope === "around"
	if (cls === "space") {
		// Cursor on whitespace: the whitespace run plus the word that follows it.
		let end = wordRun.end;
		if (end < text.length) {
			end = findRun(text, end, classify(text[end])).end;
		}
		return {
			found: true,
			to: 0,
			inclusive: false,
			range: { start: wordRun.start, end },
		};
	}
	// Cursor on a word/punct run: include trailing whitespace, or (if there is
	// none) leading whitespace instead - never both (real Vim "aw" rule).
	let { start, end } = wordRun;
	if (end < text.length && classify(text[end]) === "space") {
		end = findRun(text, end, "space").end;
	} else if (start > 0 && classify(text[start - 1]) === "space") {
		start = findRun(text, start - 1, "space").start;
	}
	return { found: true, to: 0, inclusive: false, range: { start, end } };
}

function findQuotePairs(
	text: string,
	quoteChar: string,
): Array<{ start: number; end: number }> {
	const indices: number[] = [];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === quoteChar) indices.push(i);
	}
	const pairs: Array<{ start: number; end: number }> = [];
	for (let i = 0; i + 1 < indices.length; i += 2) {
		pairs.push({ start: indices[i], end: indices[i + 1] });
	}
	return pairs;
}

function resolveQuoteObject(
	text: string,
	cursor: number,
	scope: "inner" | "around",
	quoteChar: string,
): MotionResult {
	const notFound: MotionResult = { found: false, to: 0, inclusive: false };
	const pairs = findQuotePairs(text, quoteChar);
	// Cursor is accepted if it's inside/on a pair, or (Vim quirk) before the
	// very first quote on the line - "di\"" still works from before the string.
	const pairIndex = pairs.findIndex(
		(pair, i) =>
			(cursor >= pair.start && cursor <= pair.end) ||
			(i === 0 && cursor < pair.start),
	);
	if (pairIndex === -1) return notFound;
	const pair = pairs[pairIndex];

	if (scope === "inner") {
		return {
			found: true,
			to: 0,
			inclusive: false,
			range: { start: pair.start + 1, end: pair.end },
		};
	}
	// scope === "around": the quotes themselves, plus any whitespace right
	// after the closing quote (Vim quirk for "a\"" - no leading-space fallback).
	let end = pair.end + 1;
	while (end < text.length && classify(text[end]) === "space") end++;
	return {
		found: true,
		to: 0,
		inclusive: false,
		range: { start: pair.start, end },
	};
}

function findMatchingOpenParen(text: string, fromIndex: number): number | null {
	let depth = 0;
	for (let i = fromIndex; i >= 0; i--) {
		if (text[i] === ")") depth++;
		else if (text[i] === "(") {
			if (depth === 0) return i;
			depth--;
		}
	}
	return null;
}

function findMatchingCloseParen(
	text: string,
	fromIndex: number,
): number | null {
	let depth = 0;
	for (let i = fromIndex; i < text.length; i++) {
		if (text[i] === "(") depth++;
		else if (text[i] === ")") {
			if (depth === 0) return i;
			depth--;
		}
	}
	return null;
}

// Finds the innermost ( ) pair containing (or under) the cursor. Unlike
// quotes, there is no forward search - the cursor must be on or inside a pair.
function findEnclosingParens(
	text: string,
	cursor: number,
): { open: number; close: number } | null {
	const char = text[cursor];
	if (char === "(") {
		const close = findMatchingCloseParen(text, cursor + 1);
		return close === null ? null : { open: cursor, close };
	}
	if (char === ")") {
		const open = findMatchingOpenParen(text, cursor - 1);
		return open === null ? null : { open, close: cursor };
	}
	const open = findMatchingOpenParen(text, cursor - 1);
	if (open === null) return null;
	const close = findMatchingCloseParen(text, cursor + 1);
	return close === null ? null : { open, close };
}

function resolveParenObject(
	text: string,
	cursor: number,
	scope: "inner" | "around",
): MotionResult {
	const notFound: MotionResult = { found: false, to: 0, inclusive: false };
	const pair = findEnclosingParens(text, cursor);
	if (pair === null) return notFound;
	if (scope === "inner") {
		return {
			found: true,
			to: 0,
			inclusive: false,
			range: { start: pair.open + 1, end: pair.close },
		};
	}
	return {
		found: true,
		to: 0,
		inclusive: false,
		range: { start: pair.open, end: pair.close + 1 },
	};
}

function resolveTextObject(
	text: string,
	cursor: number,
	scope: "inner" | "around",
	target: TextObjectTarget,
): MotionResult {
	switch (target) {
		case "word":
			return resolveWordObject(text, cursor, scope);
		case "doubleQuote":
			return resolveQuoteObject(text, cursor, scope, '"');
		case "singleQuote":
			return resolveQuoteObject(text, cursor, scope, "'");
		case "paren":
			return resolveParenObject(text, cursor, scope);
	}
}

// Resolves a motion to a MotionResult. Pure: does not mutate `buffer`.
export function resolveMotion(
	buffer: BufferState,
	motion: Motion,
): MotionResult {
	const { text, cursor } = buffer;
	switch (motion.type) {
		case "h":
			return {
				to: clampCursor(text, cursor - 1),
				inclusive: false,
				found: true,
			};
		case "l":
			return {
				to: clampCursor(text, cursor + 1),
				inclusive: false,
				found: true,
			};
		case "0":
			return { to: 0, inclusive: false, found: true };
		case "$":
			return { to: lastCharIndex(text), inclusive: true, found: true };
		case "w": {
			const { to, hitEnd } = wordForward(text, cursor);
			// Vim's operator+w special case: when the word moved over is the last
			// one on the line, the operated range extends through its last
			// character instead of stopping one short (see :help word-motions).
			// `inclusive` is only consulted by resolveRange (operators) - bare
			// cursor motion (executeBareMotion) reads only `to`, so this doesn't
			// change where a plain "w" lands the cursor.
			return { to, inclusive: hitEnd, found: true };
		}
		case "e":
			return { to: wordEnd(text, cursor), inclusive: true, found: true };
		case "b":
			return { to: wordBackward(text, cursor), inclusive: false, found: true };
		case "f": {
			const found = findForward(text, cursor, motion.char);
			return { to: found ?? cursor, inclusive: true, found: found !== null };
		}
		case "t": {
			// `to` is the raw target index (same as "f"), not target-1, so the
			// exclusive range formula [from, to) already lands one char short of
			// the target - this makes `dt,` delete exactly one fewer character
			// than `df,` for the same target, matching real Vim. A bare cursor
			// move (no operator) still has to land ON target-1, but that's the
			// caller's concern (see execute.ts), not this function's.
			const found = findForward(text, cursor, motion.char);
			return { to: found ?? cursor, inclusive: false, found: found !== null };
		}
		case "textObject":
			return resolveTextObject(text, cursor, motion.scope, motion.target);
	}
}
