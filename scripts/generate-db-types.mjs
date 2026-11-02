#!/usr/bin/env node
/**
 * Regenerates `apps/web/src/types/database.generated.ts` from the local
 * Supabase schema and formats it with the repository's Prettier config.
 *
 * Requires a running local Supabase instance (`supabase start`). CI installs
 * the CLI; locally, set SUPABASE_BIN when the binary is not on PATH, for
 * example SUPABASE_BIN="npx --yes supabase@2.122.0".
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "apps/web/src/types/database.generated.ts");
const cli = process.env.SUPABASE_BIN ?? "supabase";

let raw;

try {
  raw = execFileSync(`${cli} gen types typescript --local`, {
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  console.error(
    `Could not run "${cli} gen types". Is the Supabase CLI installed and is the local stack running?`,
  );
  throw error;
}

const options = (await prettier.resolveConfig(outputPath)) ?? {};
const formatted = await prettier.format(raw, {
  ...options,
  filepath: outputPath,
});

writeFileSync(outputPath, formatted);
console.log(`Wrote ${path.relative(root, outputPath)}`);
