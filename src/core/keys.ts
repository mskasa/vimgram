// Normalizes a key sequence into tokens: printable characters are individual
// tokens, special keys use Vim-style bracket notation (e.g. "<Esc>", "<BS>").
// This is the single shared representation for input recording, examples[0]
// in challenge JSON, idealKeyCount, judge's key count, and explain.
export function tokenizeKeys(input: string): string[] {
	return Array.from(input.matchAll(/<[^>]+>|./g), (m) => m[0]);
}
