import type { Page } from "@playwright/test";

/**
 * Waits until React has hydrated the document.
 *
 * Playwright can interact with server-rendered markup before React attaches its
 * handlers. Typing then is silently discarded once hydration re-renders the
 * controlled inputs, and clicking does nothing. React marks every hydrated DOM
 * node with an internal fiber property, so its presence means the page is live.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("main") ?? {}).some((key) =>
      key.startsWith("__reactFiber$"),
    ),
  );
}
