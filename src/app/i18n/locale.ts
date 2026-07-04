import type { Locale } from "../../core/i18n";

const STORAGE_KEY = "vimgram:locale";

function isLocale(value: string | null): value is Locale {
	return value === "en" || value === "ja";
}

export function detectInitialLocale(): Locale {
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (isLocale(stored)) return stored;
	return window.navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function persistLocale(locale: Locale): void {
	window.localStorage.setItem(STORAGE_KEY, locale);
}
