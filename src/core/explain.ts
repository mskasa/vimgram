import type { Locale } from "./i18n";
import { tokenizeKeys } from "./keys";
import type { Motion, TextObjectTarget } from "./motions";
import type { ParsedCommand } from "./parser";
import { initialInputState, parseKey } from "./parser";

export type ExplanationPart = { keys: string; description: string };
export type Explanation = { keys: string; parts: ExplanationPart[] };

// Basic English ordinal (2 -> "2nd", 11 -> "11th", 23 -> "23rd", ...).
function ordinal(n: number): string {
	const suffixes = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

function countPrefix(count: number | undefined): string {
	return count !== undefined && count > 1 ? String(count) : "";
}

// Canonical display char for the "paren" target: "(" is an equally valid
// input key (see parser.ts), this is purely for reconstructing `keys`.
const TEXT_OBJECT_TARGET_KEY = {
	word: "w",
	doubleQuote: '"',
	singleQuote: "'",
	paren: ")",
} satisfies Record<TextObjectTarget, string>;

function motionToKeys(motion: Motion): string {
	if (motion.type === "f" || motion.type === "t")
		return `${motion.type}${motion.char}`;
	if (motion.type === "textObject") {
		return (
			(motion.scope === "inner" ? "i" : "a") +
			TEXT_OBJECT_TARGET_KEY[motion.target]
		);
	}
	return motion.type;
}

type MotionDescriber = (params: {
	count: number | undefined;
	char?: string;
}) => string;

// Text objects have their own composition (scope x target, see
// describeTextObject below) instead of a per-Motion-type describer.
type DirectionalMotionType = Exclude<Motion["type"], "textObject">;

// Keyed 1:1 with Motion["type"] via `satisfies` - adding a new motion type
// without adding an entry here is a compile error in both locales.
const motionDescriptions = {
	en: {
		h: ({ count }) =>
			count && count > 1
				? `move left ${count} characters`
				: "move left one character",
		l: ({ count }) =>
			count && count > 1
				? `move right ${count} characters`
				: "move right one character",
		"0": () => "move to the start of the line",
		$: () => "move to the end of the line (inclusive)",
		w: ({ count }) =>
			count && count > 1
				? `move forward ${count} words`
				: "move to the start of the next word",
		e: ({ count }) =>
			count && count > 1
				? `move to the end of the word, ${count} words ahead (inclusive)`
				: "move to the end of the word (inclusive)",
		b: ({ count }) =>
			count && count > 1
				? `move back ${count} words`
				: "move to the start of the previous word",
		f: ({ count, char }) =>
			count && count > 1
				? `move to the ${ordinal(count)} next "${char}" (inclusive)`
				: `move to the next "${char}" (inclusive)`,
		t: ({ count, char }) =>
			count && count > 1
				? `move to just before the ${ordinal(count)} next "${char}" (exclusive)`
				: `move to just before the next "${char}" (exclusive)`,
	},
	ja: {
		h: ({ count }) =>
			count && count > 1 ? `${count}文字左へ移動` : "1文字左へ移動",
		l: ({ count }) =>
			count && count > 1 ? `${count}文字右へ移動` : "1文字右へ移動",
		"0": () => "行頭へ移動",
		$: () => "行末へ移動（末尾の文字を含む）",
		w: ({ count }) =>
			count && count > 1 ? `${count}単語先へ移動` : "次の単語の先頭へ移動",
		e: ({ count }) =>
			count && count > 1
				? `${count}単語先の単語の末尾へ移動（含む）`
				: "単語の末尾へ移動（含む）",
		b: ({ count }) =>
			count && count > 1 ? `${count}単語前へ移動` : "前の単語の先頭へ移動",
		f: ({ count, char }) =>
			count && count > 1
				? `${count}番目の「${char}」まで移動（含む）`
				: `次の「${char}」まで移動（含む）`,
		t: ({ count, char }) =>
			count && count > 1
				? `${count}番目の「${char}」の手前まで移動（含まない）`
				: `次の「${char}」の手前まで移動（含まない）`,
	},
} satisfies Record<Locale, Record<DirectionalMotionType, MotionDescriber>>;

// scope and target compose independently (not a per-combination dictionary):
// adding a new target (e.g. "[" / "]") only means adding one entry to
// targetLabels, not one entry per scope.
const scopeTemplates = {
	en: {
		inner: (label: string) =>
			`only the ${label} itself, not the surrounding delimiter or space (inner)`,
		around: (label: string) =>
			`the ${label} together with its surrounding delimiter or space (around)`,
	},
	ja: {
		inner: (label: string) =>
			`${label}そのものだけ。周囲の区切り記号や空白は含まない（inner）`,
		around: (label: string) =>
			`${label}に加えて、周囲の区切り記号や空白も含む（around）`,
	},
} satisfies Record<
	Locale,
	Record<"inner" | "around", (label: string) => string>
>;

const targetLabels = {
	en: {
		word: "word",
		doubleQuote: "double-quoted string",
		singleQuote: "single-quoted string",
		paren: "parenthesized text",
	},
	ja: {
		word: "単語",
		doubleQuote: "ダブルクォートで囲まれた文字列",
		singleQuote: "シングルクォートで囲まれた文字列",
		paren: "丸括弧で囲まれた文字列",
	},
} satisfies Record<Locale, Record<TextObjectTarget, string>>;

function describeTextObject(
	scope: "inner" | "around",
	target: TextObjectTarget,
	locale: Locale,
): string {
	return scopeTemplates[locale][scope](targetLabels[locale][target]);
}

const operatorDescriptions = {
	en: {
		d: "delete operator",
		y: "yank (copy) operator",
		c: "change operator (delete, then enter Insert mode)",
	},
	ja: {
		d: "削除オペレータ",
		y: "ヤンク（コピー）オペレータ",
		c: "チェンジオペレータ（削除して Insert mode へ）",
	},
} satisfies Record<Locale, Record<"d" | "y" | "c", string>>;

// Standalone (not keyed to a Motion/operator type) descriptions for the
// Insert-mode segments of a "c..." command - see explainSequence below.
const insertSegmentDescriptions: Record<Locale, string> = {
	en: "type the replacement text",
	ja: "置き換えるテキストを入力",
};
const escapeDescriptions: Record<Locale, string> = {
	en: "return to Normal mode",
	ja: "Normal mode に戻る",
};

type SingleDescriber = (params: { count: number | undefined }) => string;

const singleDescriptions = {
	en: {
		x: ({ count }) =>
			count && count > 1
				? `delete ${count} characters at and after the cursor`
				: "delete the character under the cursor",
	},
	ja: {
		x: ({ count }) =>
			count && count > 1
				? `カーソル位置から${count}文字削除`
				: "カーソル位置の1文字を削除",
	},
} satisfies Record<Locale, Record<"x", SingleDescriber>>;

function describeMotion(
	motion: Motion,
	count: number | undefined,
	locale: Locale,
): string {
	if (motion.type === "textObject") {
		return describeTextObject(motion.scope, motion.target, locale);
	}
	const describer = motionDescriptions[locale][motion.type];
	const char =
		motion.type === "f" || motion.type === "t" ? motion.char : undefined;
	return describer({ count, char });
}

// Breaks a single ParsedCommand down into its constituent keys + description
// pairs. The decomposition itself (which parts exist) comes from the
// command's structure; only the description text comes from a dictionary.
export function explain(command: ParsedCommand, locale: Locale): Explanation {
	switch (command.type) {
		case "motion": {
			const keys = countPrefix(command.count) + motionToKeys(command.motion);
			return {
				keys,
				parts: [
					{
						keys,
						description: describeMotion(command.motion, command.count, locale),
					},
				],
			};
		}
		case "single": {
			const keys = `${countPrefix(command.count)}x`;
			return {
				keys,
				parts: [
					{
						keys,
						description: singleDescriptions[locale].x({ count: command.count }),
					},
				],
			};
		}
		case "operatorMotion": {
			const motionKeys =
				countPrefix(command.count) + motionToKeys(command.motion);
			return {
				keys: command.operator + motionKeys,
				parts: [
					{
						keys: command.operator,
						description: operatorDescriptions[locale][command.operator],
					},
					{
						keys: motionKeys,
						description: describeMotion(command.motion, command.count, locale),
					},
				],
			};
		}
	}
}

// Explains a whole raw key sequence (everything typed during a round, or a
// challenge's examples[0]) by tokenizing it and segmenting it into:
//   Normal-mode command(s) -> (if "c" was used) inserted text -> <Esc>
// This needs no BufferState: it only needs to know when the parser produces
// a "c" operatorMotion, which is exactly when Insert mode begins.
// Normal-mode segments are delegated to explain() above (unchanged); only
// this function knows about the insert-text / <Esc> parts.
export function explainSequence(keys: string, locale: Locale): Explanation {
	const parts: ExplanationPart[] = [];
	let inputState = initialInputState;
	let mode: "normal" | "insert" = "normal";
	let insertBuffer = "";

	const flushInsertSegment = () => {
		if (insertBuffer !== "") {
			parts.push({
				keys: insertBuffer,
				description: insertSegmentDescriptions[locale],
			});
			insertBuffer = "";
		}
	};

	for (const token of tokenizeKeys(keys)) {
		if (mode === "insert") {
			if (token === "<Esc>") {
				flushInsertSegment();
				parts.push({ keys: "<Esc>", description: escapeDescriptions[locale] });
				mode = "normal";
			} else {
				insertBuffer += token;
			}
			continue;
		}

		if (token.length !== 1) continue; // stray special token while Normal: ignore
		const result = parseKey(inputState, token);
		inputState = result.state;
		if (!result.command) continue;
		parts.push(...explain(result.command, locale).parts);
		if (
			result.command.type === "operatorMotion" &&
			result.command.operator === "c"
		) {
			mode = "insert";
		}
	}
	flushInsertSegment(); // in case the sequence ends mid-insert without <Esc>

	return { keys: tokenizeKeys(keys).join(""), parts };
}
