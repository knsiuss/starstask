import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const envPath = resolve(__dirname, ".env.local");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Dev mode compiles each route on first request. Eight parallel workers can
  // queue more compiles than a single dev server answers in time, which shows up
  // as intermittent timeouts; four keeps the run reliable without serialising it.
  workers: process.env.CI ? 2 : 4,
  // Dev mode compiles a route on first request, which can take several seconds;
  // the default 5s assertion window can expire while the navigation is still
  // compiling.
  expect: { timeout: 15_000 },
  // A cold Turbopack compile under parallel workers can keep a single test busy
  // for longer than the 30s default, especially the visual capture that takes
  // several screenshots.
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
