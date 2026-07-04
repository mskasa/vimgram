import type { BufferState } from "./buffer";
import type { Challenge } from "./challenges";
import { idealKeyCount } from "./challenges";
import { tokenizeKeys } from "./keys";

export type JudgeResult =
	| { verdict: "great"; keyCount: number; idealKeyCount: number }
	| { verdict: "verbose"; keyCount: number; idealKeyCount: number }
	| { verdict: "fail" };

// Final-state equality: only expected fields that are actually present are
// compared, since a challenge may only care about text, or also about
// cursor/mode/yankRegister (see CLAUDE.md "正誤判定と評価").
export function matchesExpected(
	state: BufferState,
	expected: Challenge["expected"],
): boolean {
	if (state.text !== expected.text) return false;
	if (expected.cursor !== undefined && state.cursor !== expected.cursor)
		return false;
	if (expected.mode !== undefined && state.mode !== expected.mode) return false;
	if (
		expected.yankRegister !== undefined &&
		state.yankRegister !== expected.yankRegister
	)
		return false;
	return true;
}

// judge is a pure function of (challenge, final buffer state, keys typed).
// Time limits are a UI/game-loop concern and are intentionally not inputs here.
export function judge(
	challenge: Challenge,
	finalState: BufferState,
	keys: string,
): JudgeResult {
	if (!matchesExpected(finalState, challenge.expected)) {
		return { verdict: "fail" };
	}
	const keyCount = tokenizeKeys(keys).length;
	const ideal = idealKeyCount(challenge);
	return keyCount <= ideal
		? { verdict: "great", keyCount, idealKeyCount: ideal }
		: { verdict: "verbose", keyCount, idealKeyCount: ideal };
}
