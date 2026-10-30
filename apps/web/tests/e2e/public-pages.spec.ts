import { expect, test } from "@playwright/test";

// These tests run with or without a Supabase project. When it is configured,
// the extra assertions in `authenticated` blocks are exercised.
const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

test.describe("public pages", () => {
  test("homepage renders the hero and navigation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /find\. understand\. contribute\./i,
      }),
    ).toBeVisible();
    const banner = page.getByRole("banner");
    await expect(
      banner.getByRole("link", { name: "Assignments", exact: true }),
    ).toBeVisible();
    await expect(banner.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("the header search link reaches assignment search", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("banner")
      .getByRole("link", { name: "Search assignments" })
      .click();

    await expect(page).toHaveURL(
      isConfigured ? /\/login\?next=%2Fassignments/ : /\/assignments/,
    );
  });

  test("subject cards link to assignment search", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "Computer Science" }),
    ).toHaveAttribute("href", "/assignments?search=computer");
  });

  test("the FAQ accordion expands", async ({ page }) => {
    await page.goto("/");

    const question = page.getByText("Do I need an account to browse?");
    await expect(question).toBeVisible();
    await question.click();

    await expect(
      page.getByText(/Sign in with Google to search and read assignments/),
    ).toBeVisible();
  });

  test("assignment search requires a session", async ({ page }) => {
    await page.goto("/assignments?search=database");

    if (isConfigured) {
      await expect(page).toHaveURL(
        /\/login\?next=%2Fassignments%3Fsearch%3Ddatabase/,
      );
    } else {
      await expect(page.getByText("Those filters are not valid.")).toHaveCount(
        0,
      );
    }
  });

  test("assignment details require a session", async ({ page }) => {
    await page.goto("/assignments/00000000-0000-4000-8000-000000000000");

    if (isConfigured) {
      await expect(page).toHaveURL(/\/login\?next=%2Fassignments%2F/);
    } else {
      await expect(
        page.getByText("Supabase is not configured yet."),
      ).toBeVisible();
    }
  });

  test("robots.txt advertises the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Sitemap:");
  });

  test("sitemap.xml does not expose private assignment routes", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");

    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("/assignments");
  });

  test("assignment APIs reject anonymous reads", async ({ request }) => {
    for (const path of [
      "/api/assignments",
      "/api/assignments/00000000-0000-4000-8000-000000000000",
    ]) {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        error: { code: "unauthorized", message: "Sign in to continue." },
      });
    }
  });

  test("the skip link is the first focusable element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
  });
});

test.describe("protected actions", () => {
  test("an anonymous visitor is sent to the login page", async ({ page }) => {
    await page.goto("/submit");

    if (isConfigured) {
      await expect(page).toHaveURL(/\/login\?next=%2Fsubmit/);
      await expect(
        page.getByRole("button", { name: /continue with google/i }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Supabase is not configured yet.").first(),
      ).toBeVisible();
    }
  });

  test("my-assignments requires a session", async ({ page }) => {
    await page.goto("/my-assignments");

    if (isConfigured) {
      await expect(page).toHaveURL(/\/login\?next=%2Fmy-assignments/);
    } else {
      await expect(
        page.getByRole("heading", { level: 1, name: "My assignments" }),
      ).toBeVisible();
    }
  });

  test("the personal class directory requires a session", async ({ page }) => {
    await page.goto("/classes");

    if (isConfigured) {
      await expect(page).toHaveURL(/\/login\?next=%2Fclasses/);
    } else {
      await expect(
        page.getByRole("heading", { level: 1, name: "My Classes" }),
      ).toBeVisible();
    }
  });

  test("browsing approved classes stays public", async ({ page }) => {
    await page.goto("/classes/discover");

    // The heading differs only because an unconfigured build shows a setup notice.
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: isConfigured ? "Browse classes" : "Classes",
      }),
    ).toBeVisible();
  });

  test("onboarding requires a session and keeps the destination", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    // The form is never shown to an anonymous visitor, and the login page is
    // asked to return them to onboarding with the original target preserved.
    await expect(page).toHaveURL(/\/login\?next=%2Fonboarding/);
  });
});

test.describe("configured authentication", () => {
  test.skip(!isConfigured, "Requires NEXT_PUBLIC_SUPABASE_* configuration.");

  test("signing in starts the Google OAuth redirect", async ({ page }) => {
    await page.goto("/login");

    const button = page.getByRole("button", { name: /continue with google/i });
    await expect(button).toBeVisible();

    // Do not follow the redirect to Google; only assert the click starts it.
    const navigation = page.waitForRequest(
      (request) => request.url().includes("/auth/v1/authorize"),
      { timeout: 10_000 },
    );
    await button.click();
    await expect(await navigation).toBeTruthy();
  });
});
