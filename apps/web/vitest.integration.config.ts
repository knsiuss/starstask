import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Opt-in database/RLS suite. It talks to a real Supabase project (ideally a
 * local `supabase start` instance) and is skipped when the SUPABASE_TEST_*
 * variables are absent, so ordinary `pnpm test` never needs secrets.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
