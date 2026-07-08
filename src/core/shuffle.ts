// Fisher-Yates shuffle. `rng` is injected (contract: returns a float in
// [0, 1), matching Math.random) so tests can pass a seeded/fixed sequence
// instead of real randomness - see shuffle.test.ts.
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const temp = result[i];
		result[i] = result[j];
		result[j] = temp;
	}
	return result;
}
