import type { Motion } from "./motions";
import type { ParsedCommand } from "./parser";

export type Attempt = {
	challengeId: string;
	input: string;
	success: boolean;
	elapsedMs: number;
	keyCount: number;
	mistakeCount: number;
	usedCommandTypes: string[];
	// Optional, additive fields - a missing value means "no" for older stored
	// records too, so this isn't a storage schema version bump. Both are
	// always false-success rounds; these distinguish *why* so weak-point
	// analysis doesn't lump "ran out of time" in with "asked to see the
	// answer" or "chose not to solve this one" (see CLAUDE.md "正誤判定と評価").
	revealed?: boolean; // round ended via "give up" (answer + explanation shown)
	skipped?: boolean; // round ended via "skip" (no answer shown)
};

function motionTypeLabel(motion: Motion): string {
	return motion.type === "textObject"
		? `textObject:${motion.scope}:${motion.target}`
		: motion.type;
}

function commandTypeLabel(command: ParsedCommand): string {
	if (command.type === "single") return "x";
	if (command.type === "motion") return motionTypeLabel(command.motion);
	return `${command.operator}:${motionTypeLabel(command.motion)}`;
}

// Derives the distinct command "shapes" used during an attempt (e.g.
// "d:f", "c:textObject:inner:doubleQuote", "x") from the Normal-mode
// commands that were actually parsed - a future weak-point analysis (e.g.
// "struggles with t-motions") would key off these labels.
export function usedCommandTypes(commands: ParsedCommand[]): string[] {
	return [...new Set(commands.map(commandTypeLabel))];
}
