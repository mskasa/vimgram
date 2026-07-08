export type StarPromptStatus = "active" | "done" | "muted";

const STORAGE_KEY = "vimgram:starPrompt:v1";

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

function saveStatus(status: StarPromptStatus): void {
	if (!isStorageAvailable()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ status }));
	} catch {
		// e.g. quota exceeded - skip silently.
	}
}

// Defaults to "active" (never asked yet) for a missing/unparsable/unknown
// value - the only two ways out of "active" are explicit user action (see
// markStarPromptDone/markStarPromptMuted below), never a silent fallback.
export function loadStarPromptStatus(): StarPromptStatus {
	if (!isStorageAvailable()) return "active";
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw === null) return "active";
		const parsed: unknown = JSON.parse(raw);
		const status =
			parsed !== null && typeof parsed === "object"
				? (parsed as { status?: unknown }).status
				: undefined;
		return status === "done" || status === "muted" ? status : "active";
	} catch {
		return "active";
	}
}

// "Done" is optimistic, not verified (see CLAUDE.md "GitHub Star ボタン"):
// there is no way to confirm the user actually starred the repo, and this
// project doesn't chase that down. Pressing the star action is trusted at
// face value, permanently.
export function markStarPromptDone(): void {
	saveStatus("done");
}

export function markStarPromptMuted(): void {
	saveStatus("muted");
}
