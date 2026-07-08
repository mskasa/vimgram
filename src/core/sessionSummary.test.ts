import { describe, expect, it } from "vitest";
import {
	type ChallengeSessionEntry,
	summarizeSessionEntries,
	summaryHeadlineKind,
} from "./sessionSummary";

function entry(
	verdict: ChallengeSessionEntry["verdict"],
	overrides: Partial<ChallengeSessionEntry> = {},
): ChallengeSessionEntry {
	return {
		challengeId: `c-${verdict}`,
		title: { en: verdict },
		verdict,
		...overrides,
	};
}

describe("summarizeSessionEntries", () => {
	it("counts great and verbose as cleared, but only great as great", () => {
		const entries = [
			entry("great", { keyCount: 2, idealKeyCount: 2 }),
			entry("verbose", { keyCount: 5, idealKeyCount: 2 }),
		];
		expect(summarizeSessionEntries(entries)).toEqual({
			total: 2,
			clearedCount: 2,
			greatCount: 1,
			notGreatClearedCount: 1,
			notClearedCount: 0,
			assistedCount: 0,
		});
	});

	it("counts timeout/gaveUp/skipped as not cleared", () => {
		const entries = [entry("timeout"), entry("gaveUp"), entry("skipped")];
		expect(summarizeSessionEntries(entries)).toEqual({
			total: 3,
			clearedCount: 0,
			greatCount: 0,
			notGreatClearedCount: 0,
			notClearedCount: 3,
			assistedCount: 0,
		});
	});

	// An assisted clear (viewed the answer this session, then typed it) is
	// not a real clear anywhere in this app (see CLAUDE.md "永続化": 回答閲覧後
	// クリアの扱い) - it must not count toward clearedCount, even though the
	// underlying judge() verdict succeeded.
	it("does not count 'assisted' as cleared", () => {
		const entries = [
			entry("great"),
			entry("assisted", { keyCount: 2, idealKeyCount: 2 }),
		];
		expect(summarizeSessionEntries(entries)).toEqual({
			total: 2,
			clearedCount: 1,
			greatCount: 1,
			notGreatClearedCount: 0,
			notClearedCount: 1,
			assistedCount: 1,
		});
	});

	it("separates assistedCount from real failures within notClearedCount", () => {
		const entries = [entry("assisted"), entry("assisted"), entry("timeout")];
		const summary = summarizeSessionEntries(entries);
		expect(summary.notClearedCount).toBe(3);
		expect(summary.assistedCount).toBe(2);
		// notClearedCount - assistedCount is exactly the "real" failure count -
		// this is how LevelSummaryScreen tells "only assisted remains" apart
		// from "some genuine failures remain" for its subtext branch.
		expect(summary.notClearedCount - summary.assistedCount).toBe(1);
	});

	it("returns all zeros for an empty session", () => {
		expect(summarizeSessionEntries([])).toEqual({
			total: 0,
			clearedCount: 0,
			greatCount: 0,
			notGreatClearedCount: 0,
			notClearedCount: 0,
			assistedCount: 0,
		});
	});
});

describe("summaryHeadlineKind", () => {
	it("is 'allGreat' when every challenge was great", () => {
		const entries = [entry("great"), entry("great")];
		expect(summaryHeadlineKind(summarizeSessionEntries(entries))).toBe(
			"allGreat",
		);
	});

	it("is 'cleared' when everything cleared but not all were great", () => {
		const entries = [entry("great"), entry("verbose")];
		expect(summaryHeadlineKind(summarizeSessionEntries(entries))).toBe(
			"cleared",
		);
	});

	it("is 'partial' when at least one challenge was not cleared", () => {
		const entries = [entry("great"), entry("timeout")];
		expect(summaryHeadlineKind(summarizeSessionEntries(entries))).toBe(
			"partial",
		);
	});

	it("is 'partial' (not 'allGreat') for an empty session, not a false celebration", () => {
		expect(summaryHeadlineKind(summarizeSessionEntries([]))).toBe("partial");
	});

	it("is 'partial' when the only unfinished business is an assisted clear (never overstated as 'cleared')", () => {
		const entries = [entry("great"), entry("assisted")];
		expect(summaryHeadlineKind(summarizeSessionEntries(entries))).toBe(
			"partial",
		);
	});
});
