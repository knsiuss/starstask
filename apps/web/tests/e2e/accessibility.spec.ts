import { test } from "@playwright/test";

import { expectNoAccessibilityViolations } from "./support/axe";
import { waitForHydration } from "./support/hydration";

const PUBLIC_PAGES = ["/", "/classes/discover", "/login"] as const;

test.describe("public page accessibility", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      await waitForHydration(page);
      await expectNoAccessibilityViolations(page);
    });
  }
});
