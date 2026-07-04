import type { LocalizedText } from "./challenges";

export type Locale = "en" | "ja";

// en is the base language; a missing ja falls back to en (see CLAUDE.md "多言語対応").
export function resolveLocalizedText(
	text: LocalizedText,
	locale: Locale,
): string {
	if (locale === "ja" && text.ja !== undefined) {
		return text.ja;
	}
	return text.en;
}
