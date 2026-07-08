import { tokenizeKeys } from "./keys";
import { initialInputState, parseKey } from "./parser";

export type DisplayToken = { kind: "key"; text: string } | { kind: "ellipsis" };

// Total keycaps shown, most recent first when trimmed - matches the
// Playground's command history cap (see KeyCheatSheet's sibling, the
// "recent commands" list) for a consistent "most recent N" convention.
const MAX_DISPLAY_TOKENS = 12;

// Turns a raw typed-key sequence into Normal-mode display tokens for
// InputRow: one keycap per Normal-mode keystroke (including <Esc>, which
// returns to Normal), most recent 12 kept with a leading ellipsis if
// trimmed. Insert-mode characters themselves are never turned into tokens
// at all - they're already visible in the buffer, so re-listing them here
// would just be duplicated information (see CLAUDE.md "UI 操作"). This still
// needs to walk the whole sequence to know which raw keys were typed while
// Insert mode was active (so they can be skipped), tracking the same mode
// transition explain.ts's explainSequence does: a resolved "c" operatorMotion
// command opens Insert mode, <Esc> closes it.
export function buildDisplayTokens(keys: string): DisplayToken[] {
	const tokens: DisplayToken[] = [];
	let inputState = initialInputState;
	let mode: "normal" | "insert" = "normal";

	for (const token of tokenizeKeys(keys)) {
		if (mode === "insert") {
			if (token === "<Esc>") {
				tokens.push({ kind: "key", text: "<Esc>" });
				mode = "normal";
			}
			continue;
		}

		tokens.push({ kind: "key", text: token });
		if (token.length !== 1) continue; // stray special token while Normal: not parseable
		const result = parseKey(inputState, token);
		inputState = result.state;
		if (
			result.command?.type === "operatorMotion" &&
			result.command.operator === "c"
		) {
			mode = "insert";
		}
	}

	if (tokens.length > MAX_DISPLAY_TOKENS) {
		return [
			{ kind: "ellipsis" },
			...tokens.slice(tokens.length - MAX_DISPLAY_TOKENS),
		];
	}
	return tokens;
}
