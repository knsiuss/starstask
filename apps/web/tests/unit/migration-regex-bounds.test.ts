import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Postgres compiles a `~` pattern only when it first evaluates it, so a regular
 * expression whose repetition bound exceeds 255 creates its constraint happily and
 * then fails every write with SQLSTATE 2201B. Two URL checks shipped that way and
 * `20261103190000` replaced them, so migrations from that version onward are checked
 * here rather than rewriting history that has already run.
 */
const FIRST_GUARDED_VERSION = "20261103190000";

const MAX_REPETITION_BOUND = 255;

describe("migration regular expressions", () => {
  it("keeps every repetition bound within the Postgres limit", () => {
    const directory = fileURLToPath(
      new URL("../../../../supabase/migrations/", import.meta.url),
    );

    const offenders = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => (file.split("_")[0] ?? "") >= FIRST_GUARDED_VERSION)
      .flatMap((file) => {
        // Comments may quote the very bound this test forbids, so scan statements.
        const sql = readFileSync(`${directory}/${file}`, "utf8").replace(
          /--[^\n]*/g,
          "",
        );

        return [...sql.matchAll(/\{(\d+),(\d+)\}/g)]
          .filter(([, , maximum]) => Number(maximum) > MAX_REPETITION_BOUND)
          .map(
            ([, minimum, maximum]) => `${file} uses {${minimum},${maximum}}`,
          );
      });

    expect(offenders).toEqual([]);
  });
});
