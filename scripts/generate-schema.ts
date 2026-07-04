import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { challengeSchema } from "../src/core/challenges.ts";

// Only imports the schema (not loadChallenges), so this runs under plain
// Node without going through Vite's import.meta.glob transform.
const jsonSchema = z.toJSONSchema(challengeSchema);

const outPath = fileURLToPath(
	new URL("../challenges/schema.json", import.meta.url),
);
writeFileSync(outPath, `${JSON.stringify(jsonSchema, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
