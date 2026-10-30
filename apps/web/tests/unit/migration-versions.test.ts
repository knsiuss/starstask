import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("database migration versions", () => {
  it("uses a unique version for every migration file", () => {
    const directory = fileURLToPath(
      new URL("../../../../supabase/migrations/", import.meta.url),
    );
    const files = readdirSync(directory).filter((file) =>
      file.endsWith(".sql"),
    );
    const versions = files.map((file) => file.split("_")[0]);

    expect(new Set(versions).size).toBe(versions.length);
  });
});
