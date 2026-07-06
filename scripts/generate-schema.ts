import { execFileSync } from "node:child_process";
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

// Format in place so contributors never see (or forget) a "run biome
// --write after generating" step - the local binary is referenced directly
// so this works whether invoked via `pnpm run schema` or plain `node`.
const biomePath = fileURLToPath(
	new URL("../node_modules/.bin/biome", import.meta.url),
);
execFileSync(biomePath, ["check", "--write", outPath], { stdio: "inherit" });

console.log(`Wrote ${outPath}`);
