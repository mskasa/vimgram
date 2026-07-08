export type TextDiff = {
	prefix: string;
	removed: string;
	added: string;
	suffix: string;
};

// Finds the changed middle span between two strings via common
// prefix/suffix trimming - not a general LCS diff, but sufficient here
// because every operator this engine supports (delete/change/yank) mutates
// the buffer through a single contiguous [start, end) range (see
// operators.ts), so there is always exactly one changed span to find, never
// several disjoint edits. Used by the result screen's "text change" card to
// show what got removed/added without any new data beyond the challenge's
// initial text and the final buffer state.
export function diffText(before: string, after: string): TextDiff {
	const maxPrefix = Math.min(before.length, after.length);
	let prefixLen = 0;
	while (prefixLen < maxPrefix && before[prefixLen] === after[prefixLen]) {
		prefixLen++;
	}
	const maxSuffix = Math.min(before.length, after.length) - prefixLen;
	let suffixLen = 0;
	while (
		suffixLen < maxSuffix &&
		before[before.length - 1 - suffixLen] ===
			after[after.length - 1 - suffixLen]
	) {
		suffixLen++;
	}
	return {
		prefix: before.slice(0, prefixLen),
		removed: before.slice(prefixLen, before.length - suffixLen),
		added: after.slice(prefixLen, after.length - suffixLen),
		suffix: before.slice(before.length - suffixLen),
	};
}
