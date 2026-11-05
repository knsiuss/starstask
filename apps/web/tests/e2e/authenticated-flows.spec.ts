import { createHash, randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { expectNoAccessibilityViolations } from "./support/axe";
import { waitForHydration } from "./support/hydration";
import {
  createAdminClient,
  createE2eUser,
  hasLocalSupabase,
  rpc,
  signInBrowser,
  suffix,
  type E2eUser,
} from "./support/local-supabase";

/**
 * Authenticated browser flows against a disposable local Supabase stack.
 *
 * The suite skips unless E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, and
 * E2E_SUPABASE_SERVICE_ROLE_KEY point at loopback. It never runs against a
 * hosted project, so a normal `pnpm test:e2e` remains read-only.
 */
test.describe.configure({ mode: "serial" });

test.describe("authenticated workspace flows", () => {
  test.skip(
    !hasLocalSupabase,
    "Set E2E_SUPABASE_* for a local Supabase stack to run authenticated flows.",
  );

  const TIME_ZONE = "Asia/Jakarta";

  let admin: SupabaseClient;
  let approver: E2eUser;
  let classAdmin: E2eUser;
  let member: E2eUser;
  let invitee: E2eUser;
  let classId = "";
  let classSlug = "";
  let className = "";
  let courseName = "";
  let sessionId = "";
  let applicationId = "";

  async function invitationToken(): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

    await rpc(classAdmin.client, "create_class_invitation", {
      p_class_id: classId,
      p_token_hash: tokenHash,
      p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      p_max_uses: 5,
      p_email_restriction: null,
    });

    return token;
  }

  async function joinThroughRpc(user: E2eUser): Promise<void> {
    const token = await invitationToken();

    await rpc(user.client, "accept_class_invitation", { p_token: token });
  }

  test.beforeAll(async () => {
    admin = createAdminClient();
    approver = await createE2eUser(admin, "approver");
    classAdmin = await createE2eUser(admin, "owner");
    member = await createE2eUser(admin, "member");
    invitee = await createE2eUser(admin, "invitee");

    const { error: grantError } = await admin
      .from("platform_admins")
      .insert({ user_id: approver.id });

    if (grantError) {
      throw new Error(
        `Could not grant the E2E approver platform admin: ${grantError.message}`,
      );
    }

    classSlug = `e2e-class-${suffix}`;
    className = `E2E Class ${suffix}`;
    courseName = `E2E Course ${suffix}`;

    const createdApplicationId = await rpc<string>(
      classAdmin.client,
      "apply_for_class",
      {
        p_proposed_slug: classSlug,
        p_proposed_name: className,
        p_course_name: courseName,
        p_semester: "1",
        p_academic_year: "2025/2026",
        p_description: "A class used by the authenticated browser suite.",
        p_reason: "The owner maintains the assignment archive for this class.",
      },
    );

    classId = await rpc<string>(approver.client, "decide_class_application", {
      p_application_id: createdApplicationId,
      p_decision: "approved",
      p_grant_class_admin: true,
      p_note: "Approved by the authenticated browser suite.",
    });

    applicationId = createdApplicationId;

    await joinThroughRpc(member);
  });

  test.afterAll(async () => {
    if (!admin) {
      return;
    }

    // The approver is a foreign key with ON DELETE SET NULL, but a decided
    // application requires a reviewer, so the row must go before the user.
    if (applicationId) {
      const { error } = await admin
        .from("class_applications")
        .delete()
        .eq("id", applicationId);

      if (error) {
        throw new Error(
          `Could not delete the E2E class application: ${error.message}`,
        );
      }
    }

    // classes.course_id is ON DELETE RESTRICT, so rows go before courses.
    if (courseName) {
      await admin.from("classes").delete().eq("course_name", courseName);
      await admin.from("courses").delete().eq("name", courseName);
    }

    for (const user of [approver, classAdmin, member, invitee]) {
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });

  test("an invited user joins the class from the invitation page", async ({
    context,
    page,
  }) => {
    const token = await invitationToken();

    await signInBrowser(context, invitee);
    await page.goto(`/invite/${token}`);

    await expect(
      page.getByRole("heading", { name: "Class invitation" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Join class" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/app/classes/${classSlug}$`),
    );
    await expect(
      page.getByRole("heading", { level: 1, name: className }),
    ).toBeVisible();

    const { data: membership } = await admin
      .from("class_members")
      .select("user_id")
      .eq("class_id", classId)
      .eq("user_id", invitee.id)
      .maybeSingle();

    expect(membership?.user_id).toBe(invitee.id);
  });

  test("a class admin switches the join policy from class settings", async ({
    context,
    page,
  }) => {
    const readJoinPolicy = async () => {
      const { data } = await admin
        .from("classes")
        .select("join_policy")
        .eq("id", classId)
        .single();
      return data?.join_policy ?? null;
    };

    await signInBrowser(context, classAdmin);
    await page.goto(`/app/classes/${classSlug}/manage?tab=settings`);
    await waitForHydration(page);

    await page.getByRole("button", { name: "Edit", exact: true }).click();

    const joining = page.getByLabel("Joining");
    await expect(joining).toHaveValue("invitation");

    await joining.selectOption("open");
    await page.getByRole("button", { name: "Save class details" }).click();

    await expect(page.getByText("Class details saved.")).toBeVisible();
    await expect.poll(readJoinPolicy).toBe("open");

    // Restore the default so open joining cannot affect later tests.
    await joining.selectOption("invitation");
    await page.getByRole("button", { name: "Save class details" }).click();

    await expect.poll(readJoinPolicy).toBe("invitation");
  });

  test("the class workspace switches tabs and gates admin actions", async ({
    context,
    page,
  }) => {
    const classNav = page.getByRole("navigation", { name: "Class sections" });

    await signInBrowser(context, member);
    await page.goto(`/app/classes/${classSlug}`);
    await waitForHydration(page);

    await expect(
      classNav.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      classNav.getByRole("link", { name: "Assignments", exact: true }),
    ).toBeVisible();
    await expect(
      classNav.getByRole("link", { name: "Members", exact: true }),
    ).toBeVisible();
    await expect(
      classNav.getByRole("link", { name: "Schedule", exact: true }),
    ).toBeVisible();

    // A student must not see class-management entry points.
    await expect(page.getByRole("link", { name: "Manage class" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Submit assignment" }),
    ).toBeVisible();

    await classNav.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/app/classes/${classSlug}\\?tab=members$`),
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Members" }),
    ).toBeVisible();
    await expect(
      page.getByRole("table").getByText("E2E member", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Invite people" })).toHaveCount(
      0,
    );

    await classNav
      .getByRole("link", { name: "Assignments", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Assignments" }),
    ).toBeVisible();

    // The class admin sees the same workspace with manage controls.
    await signInBrowser(context, classAdmin);
    await page.goto(`/app/classes/${classSlug}`);
    await waitForHydration(page);

    await expect(
      page.getByRole("link", { name: "Manage class" }),
    ).toBeVisible();

    await classNav.getByRole("link", { name: "Members", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Invite people" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage members" }),
    ).toBeVisible();
  });

  test("a member RSVPs to a class session", async ({ context, page }) => {
    const startsAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    sessionId = await rpc<string>(
      classAdmin.client,
      "create_discussion_session",
      {
        p_class_id: classId,
        p_title: `E2E session ${suffix}`,
        p_description: "A session used by the authenticated browser suite.",
        p_starts_at: startsAt.toISOString(),
        p_ends_at: endsAt.toISOString(),
        p_time_zone: TIME_ZONE,
        p_session_type: "online",
        p_meeting_url: "https://meet.example.test/e2e",
        p_capacity: 10,
        p_visibility: "class_members",
      },
    );

    await signInBrowser(context, member);
    await page.goto(`/sessions/${sessionId}`);

    const going = page.getByRole("button", { name: "Going", exact: true });
    await expect(going).toHaveAttribute("aria-pressed", "false");

    await going.click();

    await expect(going).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/\b1 going\b/)).toBeVisible();
  });

  test("a student saves a draft, adds evidence, and submits it", async ({
    context,
    page,
  }) => {
    await signInBrowser(context, member);
    await page.goto(`/leave-requests/new?class=${classSlug}`);
    await waitForHydration(page);

    await page.getByLabel("Absence from").fill("2026-12-10");
    await page.getByLabel("Absence to").fill("2026-12-11");
    await page.getByLabel("Reason").selectOption("illness");
    await page
      .getByLabel("Explanation")
      .fill("A scheduled medical appointment requires an excused absence.");

    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(page).toHaveURL(/\/leave-requests\/[0-9a-f-]{36}$/);
    const requestUrl = page.url();
    const requestId = requestUrl.split("/").pop() ?? "";

    await page.getByLabel("Upload supporting document").setInputFiles({
      name: "surat.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
      ),
    });

    await expect(page.getByText("surat.pdf")).toBeVisible();

    await page.goto(`${requestUrl}/edit`);
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(page).toHaveURL(requestUrl);

    const { data: request } = await admin
      .from("leave_requests")
      .select("status")
      .eq("id", requestId)
      .single();

    expect(request?.status).toBe("submitted");
  });

  test("a class admin approves and publishes a member submission", async ({
    context,
    page,
  }) => {
    const title = `E2E submission ${suffix}`;

    const submissionId = await rpc<string>(
      member.client,
      "submit_class_assignment",
      {
        p_class_id: classId,
        p_title: title,
        p_description:
          "A complete submission used by the authenticated browser suite.",
        p_assignment_type: "individual",
        p_tags: ["e2e"],
      },
    );

    await signInBrowser(context, classAdmin);
    await page.goto(`/app/classes/${classSlug}/review/${submissionId}`);
    await waitForHydration(page);

    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();

    await page.getByLabel(/I reviewed the files/).check();
    await page.getByRole("button", { name: "Approve and publish" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/app/classes/${classSlug}/manage\\?reviewed=approved$`),
    );

    const { data: assignment } = await admin
      .from("assignments")
      .select("status")
      .eq("id", submissionId)
      .single();

    expect(assignment?.status).toBe("published");
  });

  test("a member reads a notification in the inbox without push", async ({
    context,
    page,
  }) => {
    // The member never registered a push device, so this proves the inbox is a
    // durable record rather than a view over push delivery. The row is written
    // by the service role because a client is not allowed to enqueue events.
    const title = `Inbox check ${suffix}`;
    const dedupeKey = `e2e-inbox-${suffix}`;

    const { error } = await admin.from("notification_events").insert({
      user_id: member.id,
      kind: "assignment_approved",
      dedupe_key: dedupeKey,
      payload: {
        title,
        body: "Stored for the inbox even without a push device.",
        url: "/app",
      },
    });

    expect(error).toBeNull();

    await signInBrowser(context, member);
    await page.goto("/notifications");
    await waitForHydration(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeVisible();

    const notification = page.getByRole("link", { name: new RegExp(title) });

    await expect(notification).toBeVisible();
    await expect(notification).toHaveAccessibleName(/Unread/);

    await notification.click();
    await expect(page).toHaveURL(/\/app$/);

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("notification_events")
          .select("read_at")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();

        return data?.read_at ?? null;
      })
      .not.toBeNull();

    await page.goto("/notifications");
    await waitForHydration(page);

    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
    ).not.toHaveAccessibleName(/Unread/);
  });

  test("a class admin manages the lifecycle and sees archive guidance", async ({
    context,
    page,
  }) => {
    await signInBrowser(context, classAdmin);
    await page.goto(`/app/classes/${classSlug}/manage?tab=settings`);
    await waitForHydration(page);

    await page.getByRole("button", { name: "Edit", exact: true }).click();

    const classCode = `E2E-${suffix}`.toUpperCase();
    await page.getByLabel("Class code").fill(classCode);
    await page.getByRole("button", { name: "Save class details" }).click();
    await expect(page.getByText("Class details saved.")).toBeVisible();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("classes")
          .select("class_code")
          .eq("id", classId)
          .single();

        return data?.class_code ?? null;
      })
      .toBe(classCode);

    await page
      .getByRole("button", { name: "Archive class", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Restore class" }),
    ).toBeVisible();
    await expect(
      page.getByText("Settings are read-only while the class is archived."),
    ).toBeVisible();

    const { data: archived } = await admin
      .from("classes")
      .select("status")
      .eq("id", classId)
      .single();
    expect(archived?.status).toBe("archived");

    await page.getByRole("button", { name: "Restore class" }).click();
    await expect(
      page.getByRole("button", { name: "Archive class", exact: true }),
    ).toBeVisible();

    const { data: restored } = await admin
      .from("classes")
      .select("status")
      .eq("id", classId)
      .single();
    expect(restored?.status).toBe("active");

    await page.getByRole("button", { name: "Delete class" }).click();
    await expect(
      page.getByText("Archive keeps the history intact."),
    ).toBeVisible();
    await expect(page.locator("#delete-class-confirm")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("the main workspace pages have no WCAG A/AA violations", async ({
    context,
    page,
  }) => {
    await signInBrowser(context, member);

    const paths = [
      "/app",
      `/app/classes/${classSlug}`,
      "/notifications",
      `/leave-requests/new?class=${classSlug}`,
      `/sessions/${sessionId}`,
    ];

    for (const path of paths) {
      await page.goto(path);
      await waitForHydration(page);
      await expectNoAccessibilityViolations(page, path);
    }
  });
});
