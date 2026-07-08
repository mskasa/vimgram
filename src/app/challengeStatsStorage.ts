import type { AttemptOutcome, ChallengeStatsMap } from "../core/challengeStats";
import {
	rebuildChallengeStatsFromAttempts,
	recordChallengeStats,
} from "../core/challengeStats";
import { loadChallenges } from "../core/challenges";
import { detectMilestones } from "../core/milestones";
import { loadAttempts } from "./attemptStorage";
import { recordDetectedMilestones } from "./milestoneStorage";

const STORAGE_KEY = "vimgram:challengeStats:v1";

function isStorageAvailable(): boolean {
	try {
		const probeKey = "__vimgram_storage_probe__";
		window.localStorage.setItem(probeKey, "1");
		window.localStorage.removeItem(probeKey);
		return true;
	} catch {
		return false;
	}
}

function readStats(): ChallengeStatsMap | null {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw === null) return null;
		const parsed: unknown = JSON.parse(raw);
		return parsed !== null && typeof parsed === "object"
			? (parsed as ChallengeStatsMap)
			: null;
	} catch {
		return null;
	}
}

function saveChallengeStats(stats: ChallengeStatsMap): void {
	if (!isStorageAvailable()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
	} catch {
		// e.g. quota exceeded - skip silently.
	}
}

// Loads challengeStats, rebuilding it once from the existing Attempt log the
// very first time it's missing (a fresh install, or a user upgrading from
// before this store existed - see CLAUDE.md "永続化"). After that first
// rebuild-and-save, this just reads the persisted map; ongoing updates are
// incremental (see recordChallengeStatsForOutcome), never a full recompute.
export function loadChallengeStats(): ChallengeStatsMap {
	if (!isStorageAvailable()) return {};
	const existing = readStats();
	if (existing !== null) return existing;
	const rebuilt = rebuildChallengeStatsFromAttempts(
		loadAttempts(),
		loadChallenges().map(({ challenge }) => challenge),
	);
	saveChallengeStats(rebuilt);
	return rebuilt;
}

// Called alongside recordAttempt, at the same two call sites (a round ending,
// or a skip) - see LevelRound.tsx. Milestone detection (see CLAUDE.md
// "永続化") is bundled in here rather than left for each call site to
// remember separately: every challengeStats update, from any screen or
// session type, automatically gets checked for a newly-crossed milestone.
export function recordChallengeStatsForOutcome(outcome: AttemptOutcome): void {
	if (!isStorageAvailable()) return;
	const prevStats = loadChallengeStats();
	const nextStats = recordChallengeStats(prevStats, outcome);
	saveChallengeStats(nextStats);
	const challenges = loadChallenges().map(({ challenge }) => challenge);
	recordDetectedMilestones(detectMilestones(prevStats, nextStats, challenges));
}
