import type { ChallengeStatsMap } from "./challengeStats";
import type { Challenge } from "./challenges";

export type ReviewBucket = "uncleared" | "notGreat";

// Recency-based, not cumulative (see CLAUDE.md "永続化": 到達度と習熟度の分離):
// both buckets key off `lastOutcome` (the most recent REAL attempt's result),
// not off "has this ever happened". A challenge that was Great long ago but
// just failed on a review attempt re-enters "uncleared" - proficiency can
// regress even though attainment (clears/greats) never does.
//
// "Uncleared": played at least once, and either never cleared at all, or the
// most recent attempt was a failure (skip-only/give-up-only attempts count
// too - see LevelRound.tsx, both update challengeStats). "Not yet Great":
// the most recent attempt was a clear, but not the fastest one (`lastOutcome`
// is "clear" or "redundant" - see challengeStats.ts). An assisted success
// (a clear reached after viewing the answer this session) never changes
// `lastOutcome`, so it deliberately doesn't move a challenge out of either
// bucket on its own (see CLAUDE.md "永続化": 回答閲覧後クリアの扱い).
//
// Both are gathered across every level (not just one), and ordered
// oldest-lastPlayedAt-first - a simple stand-in for spaced repetition (see
// CLAUDE.md "スコアリングと記録"): the longest-neglected problems surface first.
export function buildReviewQueue(
	challenges: Challenge[],
	stats: ChallengeStatsMap,
	bucket: ReviewBucket,
): Challenge[] {
	const matching = challenges.filter((challenge) => {
		const entry = stats[challenge.id];
		if (!entry || entry.attempts === 0) return false;
		return bucket === "uncleared"
			? entry.clears === 0 || entry.lastOutcome === "fail"
			: entry.lastOutcome === "clear" || entry.lastOutcome === "redundant";
	});
	return matching.sort((a, b) => {
		const aTime = stats[a.id]?.lastPlayedAt ?? 0;
		const bTime = stats[b.id]?.lastPlayedAt ?? 0;
		return aTime - bTime;
	});
}
