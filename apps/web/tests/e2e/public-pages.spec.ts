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
      page.getByRole("heading", { level: 1, name: /every assignment/i }),
    ).toBeVisible();
    const banner = page.getByRole("banner");
    await expect(
      banner.getByRole("link", { name: "Explore", exact: true }),
    ).toBeVisible();
    await expect(banner.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("explore page renders without a session", async ({ page }) => {
    await page.goto("/assignments");

    await expect(
      page.getByRole("heading", { level: 1, name: "Explore assignments" }),
    ).toBeVisible();
  });

  test("an unknown assignment id returns the not-found page", async ({
    page,
  }) => {
    await page.goto("/assignments/not-a-valid-uuid");

    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });

  test("robots.txt advertises the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Sitemap:");
  });

  test("sitemap.xml lists the explore page", async ({ request }) => {
    const response = await request.get("/sitemap.xml");

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("/assignments");
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
});

test.describe("authenticated browsing", () => {
  test.skip(!isConfigured, "Requires NEXT_PUBLIC_SUPABASE_* configuration.");

  test("filters submit through the URL and tolerate empty selects", async ({
    page,
  }) => {
    await page.goto("/assignments");

    const filters = page.getByRole("search", { name: "Filter assignments" });
    await expect(filters.getByLabel("Search")).toBeVisible();
    await filters.getByLabel("Search").fill("database");
    await filters.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(/search=database/);
    // Untouched selects submit empty values; the page must still render the
    // results instead of rejecting the query as invalid.
    await expect(page.getByText("Those filters are not valid.")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Assignments",
        level: 2,
        exact: true,
      }),
    ).toBeVisible();
  });

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
