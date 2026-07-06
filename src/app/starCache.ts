const STORAGE_KEY = "vimgram:starCount:v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REPO = "mskasa/vimgram";

type CachedStars = { count: number; fetchedAt: number };

function readCache(): CachedStars | null {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			typeof (parsed as CachedStars).count === "number" &&
			typeof (parsed as CachedStars).fetchedAt === "number"
		) {
			return parsed as CachedStars;
		}
		return null;
	} catch {
		return null;
	}
}

function writeCache(count: number): void {
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ count, fetchedAt: Date.now() } satisfies CachedStars),
		);
	} catch {
		// Quota exceeded or unavailable (private browsing) - not worth failing over.
	}
}

// Fetches the repo's star count, using localStorage as a 6h cache (the
// unauthenticated GitHub API is rate-limited to 60 requests/hour per IP -
// see CLAUDE.md "GitHub Star ボタン"). Returns null (never throws) if
// there's no usable count - offline, request failure, or no cache yet -
// so the button can still render as a plain link.
export async function fetchStarCount(): Promise<number | null> {
	const cached = readCache();
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached.count;
	}
	try {
		const response = await fetch(`https://api.github.com/repos/${REPO}`);
		if (!response.ok) return cached?.count ?? null;
		const data: unknown = await response.json();
		const count =
			typeof data === "object" &&
			data !== null &&
			typeof (data as { stargazers_count?: unknown }).stargazers_count ===
				"number"
				? (data as { stargazers_count: number }).stargazers_count
				: null;
		if (count === null) return cached?.count ?? null;
		writeCache(count);
		return count;
	} catch {
		return cached?.count ?? null;
	}
}
