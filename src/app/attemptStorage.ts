import type { Attempt } from "../core/attempt";

const STORAGE_KEY = "vimgram:attempts:v1";
const MAX_ATTEMPTS = 1000;

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

export function loadAttempts(): Attempt[] {
	if (!isStorageAvailable()) return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
	} catch {
		return [];
	}
}

// Appends an attempt and caps history at MAX_ATTEMPTS (oldest first discarded).
// Silently does nothing if localStorage is unavailable (private browsing,
// quota exceeded, etc.) - the game must keep working either way.
export function recordAttempt(attempt: Attempt): void {
	if (!isStorageAvailable()) return;
	try {
		const next = [...loadAttempts(), attempt].slice(-MAX_ATTEMPTS);
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// e.g. quota exceeded - skip silently.
	}
}
