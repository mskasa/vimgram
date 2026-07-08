import {
	appendMilestones,
	type Milestone,
	milestoneKey,
	type StoredMilestone,
} from "../core/milestones";

const STORAGE_KEY = "vimgram:milestones:v1";

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

function readMilestones(): StoredMilestone[] {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw === null) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		// Defensive migration (see CLAUDE.md "永続化"): an entry missing
		// `celebrated` is treated as already-celebrated, so a hypothetical
		// earlier schema without the field can never resurface a stale banner.
		return (parsed as Array<Milestone & { celebrated?: boolean }>).map(
			(entry) => ({ ...entry, celebrated: entry.celebrated ?? true }),
		);
	} catch {
		return [];
	}
}

function saveMilestones(milestones: StoredMilestone[]): void {
	if (!isStorageAvailable()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones));
	} catch {
		// e.g. quota exceeded - skip silently.
	}
}

// Called from challengeStatsStorage.ts's recordChallengeStatsForOutcome,
// immediately after challengeStats itself is updated - bundling the two
// into one call means every challengeStats update site gets milestone
// detection for free, with no separate call to remember (see CLAUDE.md
// "永続化").
export function recordDetectedMilestones(detected: Milestone[]): void {
	if (detected.length === 0) return;
	if (!isStorageAvailable()) return;
	saveMilestones(appendMilestones(readMilestones(), detected));
}

// Read by both LevelSummaryScreen (the primary celebration surface) and
// MenuScreen (the safety net for sessions that never reach a summary, e.g.
// leaving mid-round via Esc) - see CLAUDE.md "永続化".
export function loadUncelebratedMilestones(): StoredMilestone[] {
	if (!isStorageAvailable()) return [];
	return readMilestones().filter((milestone) => !milestone.celebrated);
}

export function markMilestonesCelebrated(celebrated: StoredMilestone[]): void {
	if (celebrated.length === 0) return;
	if (!isStorageAvailable()) return;
	const keys = new Set(celebrated.map(milestoneKey));
	const next = readMilestones().map((milestone) =>
		keys.has(milestoneKey(milestone))
			? { ...milestone, celebrated: true }
			: milestone,
	);
	saveMilestones(next);
}
