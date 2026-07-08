import type { Attempt } from "./attempt";
import { type Challenge, idealKeyCount } from "./challenges";

// Proficiency, not attainment (see CLAUDE.md "永続化"): this is "how did the
// most recent REAL attempt at this challenge go", distinct from clears/greats
// (which only ever accumulate and never move backwards). A challenge that
// was once Great can still show "fail" here after a later, failed retry -
// that's the point: forgetting brings a challenge back into review even
// though the level card's cumulative numbers don't move.
//
// "clear" is a reserved value, unreachable via the current judge() (which
// only ever returns "great" or "verbose" on a real clear) - for a possible
// future middle tier between Great and redundant.
export type LastOutcome = "great" | "clear" | "redundant" | "fail";

export type ChallengeStats = {
	clears: number;
	greats: number;
	attempts: number;
	lastPlayedAt: number;
	lastOutcome: LastOutcome;
};

export type ChallengeStatsMap = Record<string, ChallengeStats>;

const EMPTY_STATS: ChallengeStats = {
	clears: 0,
	greats: 0,
	attempts: 0,
	lastPlayedAt: 0,
	lastOutcome: "fail",
};

// What a single finished round contributes to the stats store.
// `outcome: null` means "this attempt happened, but shouldn't move
// attainment (clears/greats) or proficiency (lastOutcome) at all" - used for
// a skip (never really attempted a solve) and an assisted success, a clear
// reached after viewing the answer this session (see CLAUDE.md "永続化":
// 到達度と習熟度の分離、回答閲覧後クリアの扱い - an assisted clear should keep
// the challenge in the review rotation, not quietly mark it mastered).
// `attempts`/`lastPlayedAt` still update either way: "was this played" is a
// separate, simpler question from "did it succeed".
export type AttemptOutcome = {
	challengeId: string;
	timestamp: number;
	outcome: LastOutcome | null;
};

// Folds one round's outcome into the stats map, returning a new map (the
// input is never mutated). This is the single place "how does a round
// affect a challenge's stats" is defined - both the live app (one outcome
// at a time, see challengeStatsStorage.ts) and the one-time migration below
// (many historical outcomes in a row) go through it.
export function recordChallengeStats(
	stats: ChallengeStatsMap,
	attempt: AttemptOutcome,
): ChallengeStatsMap {
	const existing = stats[attempt.challengeId] ?? EMPTY_STATS;
	const cleared =
		attempt.outcome === "great" ||
		attempt.outcome === "clear" ||
		attempt.outcome === "redundant";
	const great = attempt.outcome === "great";
	return {
		...stats,
		[attempt.challengeId]: {
			clears: existing.clears + (cleared ? 1 : 0),
			greats: existing.greats + (great ? 1 : 0),
			attempts: existing.attempts + 1,
			lastPlayedAt: attempt.timestamp,
			lastOutcome: attempt.outcome ?? existing.lastOutcome,
		},
	};
}

// One-time migration for users who already had an Attempt log before
// challengeStats existed (see challengeStatsStorage.ts's loadChallengeStats).
// Best-effort only: log rotation (attemptStorage.ts caps history) means old
// entries may already be gone, and that's fine - the store just starts from
// whatever's left. Old Attempt records predate the `great` field, so for
// those this falls back to the same idealKeyCount comparison judge.ts uses
// (not a second, divergent "great" formula - the one already-canonical
// source, applied once during migration only). They also predate `assisted`
// entirely, so every historical success is treated as a real (non-assisted)
// clear - there's no way to reconstruct which ones, if any, followed a
// give-up within the same long-gone session.
//
// `lastPlayedAt` can't be recovered for historical attempts (Attempt has no
// wall-clock timestamp, only elapsedMs). Using each attempt's position in
// the log as a small, monotonically increasing stand-in preserves *relative*
// recency ordering (needed for the review queue's oldest-first sort) without
// colliding with real Date.now() timestamps recorded from this point on -
// those are ~13 orders of magnitude larger than any log index.
export function rebuildChallengeStatsFromAttempts(
	attempts: Attempt[],
	challenges: Challenge[],
): ChallengeStatsMap {
	const idealByChallenge = new Map(
		challenges.map((challenge) => [challenge.id, idealKeyCount(challenge)]),
	);
	let stats: ChallengeStatsMap = {};
	attempts.forEach((attempt, index) => {
		const ideal = idealByChallenge.get(attempt.challengeId);
		let outcome: LastOutcome | null;
		if (attempt.skipped) {
			outcome = null;
		} else if (!attempt.success) {
			outcome = "fail";
		} else {
			const great =
				attempt.great ?? (ideal !== undefined && attempt.keyCount <= ideal);
			outcome = great ? "great" : "redundant";
		}
		stats = recordChallengeStats(stats, {
			challengeId: attempt.challengeId,
			timestamp: index,
			outcome,
		});
	});
	return stats;
}
