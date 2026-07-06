import type { Locale } from "../../core/i18n";

const STORAGE_KEY = "vimgram:locale";

function isLocale(value: string | null): value is Locale {
	return value === "en" || value === "ja";
}

// localStorage access can throw (Safari private browsing, storage disabled
// by policy, etc.) - guarded the same way as attemptStorage.ts/starCache.ts
// so a locale read/write failure never crashes app startup.
export function detectInitialLocale(): Locale {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (isLocale(stored)) return stored;
	} catch {
		// fall through to browser-language detection below
	}
	return window.navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function persistLocale(locale: Locale): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		// e.g. quota exceeded or unavailable - the toggle still works for
		// the current session, it just won't persist across reloads.
	}
}
