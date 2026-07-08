import type { LocalizedText } from "./challenges";

// One row of the level summary's per-challenge breakdown (see CLAUDE.md "UI
// 操作"): recorded once per challenge played this session, in
// src/app/pages/LevelRound.tsx. A session-internal retry overwrites the
// previous entry for that same challenge rather than adding a second row -
// only the LAST attempt counts as that challenge's result for the summary.
export type ChallengeSessionEntry = {
	challengeId: string;
	title: LocalizedText;
	verdict: "great" | "verbose" | "assisted" | "timeout" | "gaveUp" | "skipped";
	// Only meaningful for "great"/"verbose"/"assisted" - the verdicts that
	// reach a judged clear (see judge.ts). Absent for timeout/gaveUp/skipped.
	keyCount?: number;
	idealKeyCount?: number;
};

export type SessionSummary = {
	total: number;
	clearedCount: number; // great + verbose
	greatCount: number;
	// Cleared, but not with the fewest keys (verbose only).
	notGreatClearedCount: number;
	// Never reached a REAL clear this session (timeout, gaveUp, skipped, OR
	// assisted - see assistedCount below, a subset of this).
	notClearedCount: number;
	// Subset of notClearedCount that WAS actually cleared, just after
	// viewing the answer (see CLAUDE.md "永続化": 回答閲覧後クリアの扱い) -
	// broken out separately so the summary screen can tell "you cleared
	// these, just not for real credit yet" apart from "you didn't finish
	// these at all" (see LevelSummaryScreen.tsx's partial-branch subtext).
	assistedCount: number;
};

// Pure aggregation over a session's per-challenge entries - the single
// source of truth for every summary-screen number (headline branch, metric
// cards, subtext counts), so none of them can drift relative to each other
// the way two separately-maintained tallies could (see CLAUDE.md "永続化"
// for the same reasoning applied to challengeStats vs. the Attempt log).
export function summarizeSessionEntries(
	entries: ChallengeSessionEntry[],
): SessionSummary {
	let clearedCount = 0;
	let greatCount = 0;
	let assistedCount = 0;
	for (const entry of entries) {
		if (entry.verdict === "great") {
			clearedCount++;
			greatCount++;
		} else if (entry.verdict === "verbose") {
			clearedCount++;
		} else if (entry.verdict === "assisted") {
			// Deliberately does NOT increment clearedCount - it isn't a real
			// clear anywhere in this app (see CLAUDE.md "永続化": 回答閲覧後
			// クリアの扱い), so a session containing one correctly falls into
			// the "partial" headline branch rather than overstating it as
			// fully cleared.
			assistedCount++;
		}
	}
	return {
		total: entries.length,
		clearedCount,
		greatCount,
		notGreatClearedCount: clearedCount - greatCount,
		notClearedCount: entries.length - clearedCount,
		assistedCount,
	};
}

// The summary's 3-way headline branch (see CLAUDE.md "UI 操作": 見出しは
// 実結果と食い違う文言を使わない) - a plain function of the aggregate counts,
// so the headline can never claim "レベルクリア" while a challenge in the
// session actually timed out or was skipped.
export type SummaryHeadlineKind = "allGreat" | "cleared" | "partial";

export function summaryHeadlineKind(
	summary: SessionSummary,
): SummaryHeadlineKind {
	if (summary.total > 0 && summary.greatCount === summary.total) {
		return "allGreat";
	}
	if (summary.total > 0 && summary.clearedCount === summary.total) {
		return "cleared";
	}
	return "partial";
}
