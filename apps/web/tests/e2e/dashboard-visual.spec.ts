import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { waitForHydration } from "./support/hydration";
import {
  createAdminClient,
  createE2eUser,
  hasLocalSupabase,
  signInBrowser,
  suffix,
  type E2eUser,
} from "./support/local-supabase";

/**
 * Local-only visual capture of the dashboard. Seeds one class with realistic
 * deadlines, sessions, an absence, and notifications, then screenshots the
 * rendered page so the mockup can be compared against real output.
 */
test.describe.configure({ mode: "serial" });

test.describe("dashboard visual capture", () => {
  test.skip(
    !hasLocalSupabase,
    "Set E2E_SUPABASE_* for a local Supabase stack to capture the dashboard.",
  );

  const TIME_ZONE = "Asia/Jakarta";
  const outputDir =
    process.env.DASHBOARD_SHOT_DIR ??
    resolve(__dirname, "../../test-results/dashboard-shots");

  let admin: SupabaseClient;
  let lecturer: E2eUser;
  let student: E2eUser;
  let classId = "";
  let courseId = "";

  test.beforeAll(async () => {
    admin = createAdminClient();
    lecturer = await createE2eUser(admin, "visual-lecturer");
    student = await createE2eUser(admin, "visual-student");

    await admin
      .from("profiles")
      .update({ display_name: "Aisyah Putri" })
      .eq("id", student.id);

    const { data: course, error: courseError } = await admin
      .from("courses")
      .insert({ name: `Visual Course ${suffix}`, code: "VIS101" })
      .select("id")
      .single();

    if (courseError || !course) {
      throw new Error(`Could not seed course: ${courseError?.message}`);
    }

    courseId = course.id;

    const { data: classRow, error: classError } = await admin
      .from("classes")
      .insert({
        slug: `visual-class-${suffix}`,
        name: "Information Systems 2A",
        description: "A seeded class used to capture the dashboard design.",
        course_id: courseId,
        course_name: "Information Systems",
        institution: "Universitas Indonesia",
        lecturer_name: "Dr. Rangga Prasetyo",
        semester: "2",
        academic_year: "2026/2027",
        status: "active",
        created_by: lecturer.id,
        join_policy: "invitation",
      })
      .select("id")
      .single();

    if (classError || !classRow) {
      throw new Error(`Could not seed class: ${classError?.message}`);
    }

    classId = classRow.id;

    const { error: memberError } = await admin.from("class_members").insert([
      {
        class_id: classId,
        user_id: lecturer.id,
        joined_via: "admin_assignment",
      },
      { class_id: classId, user_id: student.id, joined_via: "invitation" },
    ]);

    if (memberError) {
      throw new Error(`Could not seed members: ${memberError.message}`);
    }

    await admin.from("class_admins").insert({
      class_id: classId,
      user_id: lecturer.id,
    });

    await admin.from("class_subjects").insert([
      { class_id: classId, name: "Database Systems", created_by: lecturer.id },
      { class_id: classId, name: "Systems Analysis", created_by: lecturer.id },
      { class_id: classId, name: "Web Engineering", created_by: lecturer.id },
    ]);

    const now = Date.now();
    const hours = (count: number) => count * 60 * 60 * 1000;
    const days = (count: number) => count * 24 * 60 * 60 * 1000;

    const { error: assignmentError } = await admin.from("assignments").insert([
      {
        title: "Normalization case study",
        description: "Normalize the supplied schema to third normal form.",
        course_id: courseId,
        user_id: lecturer.id,
        class_id: classId,
        status: "published",
        deadline: new Date(now - days(2)).toISOString(),
        published_at: new Date(now - days(9)).toISOString(),
        assignment_type: "individual",
        semester: "2",
        academic_year: "2026/2027",
      },
      {
        title: "Query optimisation lab",
        description: "Profile the slow queries and rewrite them with indexes.",
        course_id: courseId,
        user_id: lecturer.id,
        class_id: classId,
        status: "published",
        deadline: new Date(now + hours(4)).toISOString(),
        published_at: new Date(now - days(1)).toISOString(),
        assignment_type: "lab",
        semester: "2",
        academic_year: "2026/2027",
      },
      {
        title: "ERD for the library system",
        description: "Model the entities, relationships, and cardinalities.",
        course_id: courseId,
        user_id: lecturer.id,
        class_id: classId,
        status: "published",
        deadline: new Date(now + days(2)).toISOString(),
        published_at: new Date(now - days(2)).toISOString(),
        assignment_type: "group",
        semester: "2",
        academic_year: "2026/2027",
      },
      {
        title: "Accessibility audit report",
        description: "Audit the course portal against WCAG 2.2 AA.",
        course_id: courseId,
        user_id: lecturer.id,
        class_id: classId,
        status: "published",
        deadline: new Date(now + days(4)).toISOString(),
        published_at: new Date(now - days(4)).toISOString(),
        assignment_type: "project",
        semester: "2",
        academic_year: "2026/2027",
      },
      {
        title: "Weekly reflective journal",
        description: "Summarise what you learned in this week's sessions.",
        course_id: courseId,
        user_id: lecturer.id,
        class_id: classId,
        status: "published",
        deadline: new Date(now + hours(5)).toISOString(),
        published_at: new Date(now - days(6)).toISOString(),
        assignment_type: "other",
        semester: "2",
        academic_year: "2026/2027",
      },
    ]);

    if (assignmentError) {
      throw new Error(`Could not seed assignments: ${assignmentError.message}`);
    }

    const { error: sessionError } = await admin
      .from("discussion_sessions")
      .insert([
        {
          class_id: classId,
          organizer_id: lecturer.id,
          title: "Database lab walkthrough",
          description: "Hands-on walkthrough of the normalisation exercise.",
          session_type: "online",
          meeting_url: "https://meet.example.test/visual-lab",
          starts_at: new Date(now + hours(6)).toISOString(),
          ends_at: new Date(now + hours(8)).toISOString(),
          time_zone: TIME_ZONE,
          visibility: "class_members",
          status: "scheduled",
        },
        {
          class_id: classId,
          organizer_id: lecturer.id,
          title: "Systems analysis clinic",
          description: "Open clinic for questions about the ERD assignment.",
          session_type: "in_person",
          location: "Lab 3.02",
          starts_at: new Date(now + days(2) + hours(1)).toISOString(),
          ends_at: new Date(now + days(2) + hours(3)).toISOString(),
          time_zone: TIME_ZONE,
          visibility: "class_members",
          status: "scheduled",
        },
      ]);

    if (sessionError) {
      throw new Error(`Could not seed sessions: ${sessionError.message}`);
    }

    // Jakarta is UTC+7, so shift before slicing to get the local calendar day.
    const today = new Date(now + hours(7)).toISOString().slice(0, 10);
    const tomorrow = new Date(now + days(1) + hours(7))
      .toISOString()
      .slice(0, 10);

    const { error: leaveError } = await admin.from("leave_requests").insert({
      student_id: student.id,
      class_id: classId,
      leave_start_date: today,
      leave_end_date: tomorrow,
      reason_category: "illness",
      explanation: "Medical appointment at the campus clinic.",
      status: "submitted",
      submitted_at: new Date(now - hours(3)).toISOString(),
    });

    if (leaveError) {
      throw new Error(`Could not seed absence: ${leaveError.message}`);
    }

    const { error: notificationError } = await admin
      .from("notification_events")
      .insert([
        {
          user_id: student.id,
          kind: "assignment_approved",
          dedupe_key: `visual-approved-${suffix}`,
          payload: {
            title: "New assignment published",
            body: "Query optimisation lab is now available in Information Systems 2A.",
            url: "/dashboard/assignments",
          },
          status: "sent",
          sent_at: new Date(now - hours(2)).toISOString(),
          created_at: new Date(now - hours(2)).toISOString(),
        },
        {
          user_id: student.id,
          kind: "leave_request_forwarded",
          dedupe_key: `visual-forwarded-${suffix}`,
          payload: {
            title: "Absence request forwarded",
            body: "Your absence request for 31 Oct has been forwarded to the lecturer.",
            url: "/leave-requests",
          },
          status: "sent",
          sent_at: new Date(now - days(1)).toISOString(),
          created_at: new Date(now - days(1)).toISOString(),
        },
        {
          user_id: student.id,
          kind: "session_updated",
          dedupe_key: `visual-session-${suffix}`,
          payload: {
            title: "Session moved",
            body: "Systems analysis clinic moved to Lab 3.02.",
            url: "/schedule",
          },
          status: "sent",
          sent_at: new Date(now - days(3)).toISOString(),
          created_at: new Date(now - days(3)).toISOString(),
        },
      ]);

    if (notificationError) {
      throw new Error(
        `Could not seed notifications: ${notificationError.message}`,
      );
    }
  });

  test.afterAll(async () => {
    if (!admin) {
      return;
    }

    if (courseId) {
      await admin.from("assignments").delete().eq("course_id", courseId);
      await admin.from("classes").delete().eq("course_id", courseId);
      await admin.from("courses").delete().eq("id", courseId);
    }

    for (const user of [lecturer, student]) {
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });

  test("renders the dashboard at desktop and mobile widths", async ({
    context,
    page,
  }) => {
    mkdirSync(outputDir, { recursive: true });
    await signInBrowser(context, student);

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/dashboard");
    await waitForHydration(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Aisyah" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "My week" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My classes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Priority tasks" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent assignments" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Notifications" }).first(),
    ).toBeVisible();

    // The week strip keeps fixed-width days: it scrolls sideways (opening at
    // today) and every day column keeps the same height. Scroll positioning
    // happens after hydration, so poll instead of reading once.
    const scroller = page.locator("[data-week-scroller]");

    await expect
      .poll(() => scroller.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);

    const strip = await scroller.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);

    const dayHeights = await page
      .locator('section[aria-labelledby="my-week"] ol > li')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height),
      );

    expect(new Set(dayHeights).size).toBe(1);

    await page.screenshot({
      path: resolve(outputDir, "dashboard-desktop.png"),
      fullPage: true,
    });

    // The Week control must open and keep the week offset in its links.
    await page.locator("summary", { hasText: "Week" }).click();
    await expect(page.getByRole("link", { name: "Last week" })).toBeVisible();

    await page.screenshot({
      path: resolve(outputDir, "dashboard-week-menu.png"),
      fullPage: false,
    });

    await page.getByRole("link", { name: "Last week" }).click();
    await expect(page).toHaveURL(/\/dashboard\?week=-1$/);

    await page.goto("/dashboard");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    await expect(
      page.getByRole("heading", { name: "My classes" }),
    ).toBeVisible();

    const mobileWidth = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(mobileWidth.scrollWidth).toBeLessThanOrEqual(mobileWidth.innerWidth);

    await page.screenshot({
      path: resolve(outputDir, "dashboard-mobile.png"),
      fullPage: true,
    });
  });
});
