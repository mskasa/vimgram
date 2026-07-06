// Maps a raw DOM KeyboardEvent.key to our normalized key token (see
// src/core/keys.ts). Returns null for keys we don't handle (Shift, Tab,
// arrow keys, etc.) so callers can ignore them.
export function domKeyToToken(domKey: string): string | null {
	if (domKey === "Escape") return "<Esc>";
	if (domKey === "Backspace") return "<BS>";
	if (domKey.length === 1) return domKey;
	return null;
}

// Cmd/Ctrl/Alt+key combos must fall through to the browser (Cmd+R reload,
// Ctrl+... browser shortcuts, etc.) rather than being captured as game
// input - see CLAUDE.md "UI 操作". Shift is excluded on purpose: it's how
// "?" and uppercase letters are typed at all, so treating it as a
// game-input-blocking modifier would break those keys' own mappings.
export function hasModifierKey(event: KeyboardEvent): boolean {
	return event.metaKey || event.ctrlKey || event.altKey;
}
