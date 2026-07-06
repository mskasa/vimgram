import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBuffer } from "./buffer";
import { challengeSchema, idealKeyCount, loadChallenges } from "./challenges";
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

describe("challenges/schema.json", () => {
	// Guards against drift in the *other* direction from the examples[0]
	// checks above: someone changes challengeSchema (src/core/challenges.ts)
	// but forgets to run `pnpm run schema`, leaving the committed JSON Schema
	// stale relative to what actually validates challenge JSON files.
	it("matches what `pnpm run schema` would currently generate", () => {
		const expected = z.toJSONSchema(challengeSchema);
		const schemaPath = fileURLToPath(
			new URL("../../challenges/schema.json", import.meta.url),
		);
		const actual: unknown = JSON.parse(readFileSync(schemaPath, "utf-8"));
		expect(actual).toEqual(expected);
	});
});
