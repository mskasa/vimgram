import { describe, expect, it } from "vitest";
import { createBuffer } from "./buffer";
import { idealKeyCount, loadChallenges } from "./challenges";
import { runKeys } from "./execute";
import { matchesExpected } from "./judge";
import { tokenizeKeys } from "./keys";

// Structural (schema + duplicate-id) validation happens as a side effect of
// loadChallenges() itself, which throws on any violation - a broken JSON
// file under challenges/ fails this whole suite immediately.
const loaded = loadChallenges();

describe("challenges/ data", () => {
	it("has at least one challenge", () => {
		expect(loaded.length).toBeGreaterThan(0);
	});

	it.each(
		loaded.map(({ challenge }) => [challenge.id, challenge] as const),
	)("%s: examples[0] solves initial -> expected", (_id, challenge) => {
		const initialBuffer = createBuffer(
			challenge.initial.text,
			challenge.initial.cursor,
			challenge.initial.mode,
		);
		const finalBuffer = runKeys(initialBuffer, challenge.examples[0]);
		expect(matchesExpected(finalBuffer, challenge.expected)).toBe(true);
	});

	it.each(
		loaded.map(({ challenge }) => [challenge.id, challenge] as const),
	)("%s: idealKeyCount is derived from examples[0]'s token count, not stored separately", (_id, challenge) => {
		expect(idealKeyCount(challenge)).toBe(
			tokenizeKeys(challenge.examples[0]).length,
		);
	});
});
