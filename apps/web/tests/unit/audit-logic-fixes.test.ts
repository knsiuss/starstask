import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  getDueSoonWindow,
  summarizeAttendance,
  summarizeCheckInDay,
  toJakartaDateKey,
} from "@starstask/shared";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = fileURLToPath(
  new URL(
    "../../../../supabase/migrations/20270121000000_audit_logic_fixes.sql",
    import.meta.url,
  ),
);

describe("20270121000000_audit_logic_fixes.sql", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("tracks lecturer revocation and revokes lecturer-created class admin access on demotion", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS lecturer_revoked_at");
    expect(sql).toContain("DELETE FROM public.class_admins ca");
    expect(sql).toContain("UPDATE public.class_admin_assignments a");
    expect(sql).toContain("v_existing.lecturer_revoked_at IS NOT NULL");
    expect(sql).toContain("lecturer role was revoked by an administrator");
  });

  it("drops the 3-arg grant_lecturer_membership_if_eligible overload and forwards p_university_id", () => {
    expect(sql).toContain(
      "DROP FUNCTION IF EXISTS public.grant_lecturer_membership_if_eligible (uuid, text, text);",
    );
    expect(sql).toContain("p_university_id uuid DEFAULT NULL");
    expect(sql).toContain("OR uni.id = p_university_id");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.grant_lecturer_membership_if_eligible (uuid, text, text, uuid)",
    );
  });

  it("uses Asia/Jakarta date boundary and excludes completed assignments in get_dashboard_overview", () => {
    expect(sql).toContain(
      "((v_now AT TIME ZONE 'Asia/Jakarta')::date)::timestamp AT TIME ZONE 'Asia/Jakarta'",
    );
    expect(sql).not.toContain("CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'");
    expect(sql).toContain(
      "FROM\n                      public.assignment_completions ac",
    );
  });

  it("validates class_subjects ownership in set_leave_request_subjects", () => {
    expect(sql).toContain("FROM\n            public.class_subjects cs");
    expect(sql).toContain("cs.class_id = v_request.class_id");
  });

  it("allows cancelling revision_requested leave requests in cancel_leave_request", () => {
    expect(sql).toContain("('draft', 'submitted', 'revision_requested')");
    expect(sql).toContain("('submitted', 'revision_requested')");
  });

  it("validates current assignment status for unpublish and archive in moderate_assignment", () => {
    expect(sql).toContain("only published assignments can be unpublished");
    expect(sql).toContain(
      "only published or unpublished assignments can be archived",
    );
  });
});

describe("Asia/Jakarta deadline window boundaries", () => {
  it("uses Jakarta calendar day when UTC is still the previous day", () => {
    const utcEvening = new Date("2026-11-17T18:00:00.000Z");

    expect(toJakartaDateKey(utcEvening)).toBe("2026-11-18");

    const window = getDueSoonWindow(utcEvening);

    expect(window.start.toISOString()).toBe("2026-11-17T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-25T17:00:00.000Z");
  });
});

describe("attendance summary invariants", () => {
  it("counts present, late, excused, and absent sessions accurately", () => {
    const summary = summarizeAttendance([
      "present",
      "late",
      "excused",
      "absent",
    ]);

    expect(summary).toEqual({
      present: 1,
      late: 1,
      excused: 1,
      sick: 0,
      absent: 1,
      unrecorded: 0,
      pending: 0,
      eligible: 3,
      attended: 2,
      percentage: 66.7,
    });
  });

  it("summarizes check-in day sessions by status and open window", () => {
    const nowMs = Date.parse("2026-11-18T02:00:00.000Z");
    const dayCounts = summarizeCheckInDay(
      [
        {
          opensAt: "2026-11-18T01:00:00.000Z",
          closesAt: "2026-11-18T03:00:00.000Z",
          status: "present",
        },
        {
          opensAt: "2026-11-18T01:00:00.000Z",
          closesAt: "2026-11-18T03:00:00.000Z",
          status: null,
        },
        {
          opensAt: "2026-11-18T00:00:00.000Z",
          closesAt: "2026-11-18T01:00:00.000Z",
          status: null,
        },
        {
          opensAt: "2026-11-18T01:00:00.000Z",
          closesAt: "2026-11-18T03:00:00.000Z",
          status: "excused",
        },
      ],
      nowMs,
    );

    expect(dayCounts).toEqual({
      present: 1,
      late: 0,
      notCheckedIn: 1,
    });
  });
});
