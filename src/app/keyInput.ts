// Maps a raw DOM KeyboardEvent.key to our normalized key token (see
// src/core/keys.ts). Returns null for keys we don't handle (Shift, Tab,
// arrow keys, etc.) so callers can ignore them.
export function domKeyToToken(domKey: string): string | null {
	if (domKey === "Escape") return "<Esc>";
	if (domKey === "Backspace") return "<BS>";
	if (domKey.length === 1) return domKey;
	return null;
}
