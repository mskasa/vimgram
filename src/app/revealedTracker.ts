// In-memory only, deliberately not persisted (see CLAUDE.md "永続化" and the
// ADR for this feature) - a module-level singleton Set survives across
// screens/sessions within one page load (LevelRound remounts between
// challenges, GamePage switches screens, none of that clears it), but resets
// on reload. That's intentional: reloading to "launder" a revealed challenge
// back into a real clear only fools the player themselves, and the natural
// friction of a reload also gives the review queue's oldest-first ordering a
// moment to breathe before the same challenge could resurface.
const revealedChallengeIds = new Set<string>();

export function markRevealed(challengeId: string): void {
	revealedChallengeIds.add(challengeId);
}

export function wasRevealed(challengeId: string): boolean {
	return revealedChallengeIds.has(challengeId);
}
