import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  attendanceMeetingCorrectionSchema,
  getAttendanceLateDeadline,
} from "@starstask/contracts";
import { describeGeolocationError } from "@/lib/geo/position";
import {
  buildMeetingWorkbook,
  buildRecapWorkbook,
  type AttendanceExportContext,
} from "@/features/attendance-meetings/excel";
import { buildAttendanceReportPdf } from "@/features/attendance-meetings/pdf";
import type {
  AttendanceCorrectionAuditEntry,
  AttendanceMeetingDetail,
  AttendanceRecap,
} from "@/lib/attendance/meeting-types";

const GENERATED_AT = new Date("2026-02-20T10:30:00+07:00");

const context: AttendanceExportContext = {
  classInfo: {
    name: "TPLM002 — Class A",
    class_code: "TPLM002",
    course_name: "Interaksi Manusia dan Komputer",
    lecturer_name: "Dr. Sari",
    semester: "Ganjil",
    academic_year: "2025/2026",
  },
  subject: {
    id: "subject-1",
    name: "Interaksi Manusia dan Komputer",
    code: "IMK",
    lecturerName: "Dr. Sari",
    semester: "Ganjil",
    academicYear: "2025/2026",
  },
  generatedAt: GENERATED_AT,
};

const audit: AttendanceCorrectionAuditEntry = {
  id: "audit-1",
  sessionId: "meeting-1",
  meetingNumber: 1,
  meetingDate: "2026-02-10",
  studentId: "user-budi",
  studentNim: "221002",
  studentName: "Budi Santoso",
  subjectId: "subject-1",
  subjectName: "Interaksi Manusia dan Komputer",
  previousStatus: "not_recorded",
  newStatus: "present",
  reason: "Student in room; GPS accuracy too poor",
  physicallyVerified: true,
  verificationMethod: "physical",
  adminName: "Dr. Sari",
  createdAt: "2026-02-10T12:00:00+07:00",
};

const detail: AttendanceMeetingDetail = {
  sessionId: "meeting-1",
  subjectId: "subject-1",
  subjectName: "Interaksi Manusia dan Komputer",
  subjectCode: "IMK",
  meetingNumber: 1,
  meetingDate: "2026-02-10",
  title: "Pendahuluan",
  location: "Lab 3",
  startsAt: "2026-02-10T09:00:00+07:00",
  endsAt: "2026-02-10T11:00:00+07:00",
  opensAt: "2026-02-10T08:45:00+07:00",
  closesAt: "2026-02-10T09:15:00+07:00",
  openedAt: "2026-02-10T08:45:00+07:00",
  closedAt: "2026-02-10T09:15:00+07:00",
  finalizedAt: "2026-02-10T09:16:00+07:00",
  radiusM: 100,
  lateAfterMinutes: 10,
  phase: "finalized",
  counts: {
    expected: 1,
    present: 1,
    late: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    notRecorded: 0,
    failed: 0,
  },
  roster: [
    {
      userId: "user-budi",
      fullName: "Budi Santoso",
      nim: "221002",
      displayName: "Budi Santoso",
      joinedAt: "2025-09-01T00:00:00+07:00",
      eligible: true,
      status: "present",
      method: "manual",
      checkedInAt: "2026-02-10T12:00:00+07:00",
      distanceM: null,
      accuracyM: null,
      note: null,
      reviewedAt: null,
      identityVerified: false,
    },
  ],
  failures: [],
};

const recap: AttendanceRecap = {
  meetings: [
    {
      sessionId: "meeting-1",
      meetingNumber: 1,
      meetingDate: "2026-02-10",
      startsAt: "2026-02-10T09:00:00+07:00",
      endsAt: "2026-02-10T11:00:00+07:00",
      title: "Pendahuluan",
      location: "Lab 3",
      opensAt: null,
      closesAt: null,
      openedAt: "2026-02-10T08:45:00+07:00",
      closedAt: "2026-02-10T09:15:00+07:00",
      finalizedAt: "2026-02-10T09:16:00+07:00",
      phase: "finalized",
      opened: true,
    },
  ],
  students: [
    {
      userId: "user-budi",
      fullName: "Budi Santoso",
      nim: "221002",
      joinedAt: "2025-09-01T00:00:00+07:00",
      cells: { "meeting-1": "present" },
      totals: {
        present: 1,
        late: 0,
        excused: 0,
        sick: 0,
        absent: 0,
        notRecorded: 0,
        attended: 1,
        eligible: 1,
        percentage: 100,
      },
    },
  ],
};

async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
  return workbook;
}

function requireSheet(workbook: ExcelJS.Workbook, name: string) {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`Missing worksheet ${name}`);
  return sheet;
}

function sheetText(sheet: ExcelJS.Worksheet): string {
  const parts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === "string") parts.push(cell.value);
    });
  });
  return parts.join("\n");
}

describe("attendanceMeetingCorrectionSchema boundaries", () => {
  const valid = {
    userId: "11111111-1111-4111-8111-111111111111",
    status: "present",
    reason: "GPS accuracy too poor; student seen in room",
    physicallyVerified: true,
  } as const;

  it("accepts a reason at exactly the minimum and maximum lengths", () => {
    expect(
      attendanceMeetingCorrectionSchema.safeParse({ ...valid, reason: "abc" })
        .success,
    ).toBe(true);
    expect(
      attendanceMeetingCorrectionSchema.safeParse({
        ...valid,
        reason: "x".repeat(500),
      }).success,
    ).toBe(true);
  });

  it("rejects reasons that are too short or too long", () => {
    expect(
      attendanceMeetingCorrectionSchema.safeParse({ ...valid, reason: "ab" })
        .success,
    ).toBe(false);
    expect(
      attendanceMeetingCorrectionSchema.safeParse({
        ...valid,
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("rejects present without physical verification", () => {
    expect(
      attendanceMeetingCorrectionSchema.safeParse({
        ...valid,
        physicallyVerified: false,
      }).success,
    ).toBe(false);
  });
});

describe("late status boundary", () => {
  it("marks check-in at the deadline as present and after as late", () => {
    const deadline = getAttendanceLateDeadline("2026-02-10T09:00:00+07:00", 10);
    expect(deadline).toBe(Date.parse("2026-02-10T09:10:00+07:00"));

    const statusAt = (ts: string) =>
      Date.parse(ts) <= (deadline ?? 0) ? "present" : "late";
    expect(statusAt("2026-02-10T09:10:00+07:00")).toBe("present");
    expect(statusAt("2026-02-10T09:10:01+07:00")).toBe("late");
  });
});

describe("geolocation error mapping", () => {
  it("maps permission, unavailable, and timeout codes to distinct messages", () => {
    const denied = describeGeolocationError({ code: 1 });
    const unavailable = describeGeolocationError({ code: 2 });
    const timeout = describeGeolocationError({ code: 3 });

    expect(denied).toContain("denied");
    expect(unavailable).toContain("unavailable");
    expect(timeout).toContain("too long");
    expect(new Set([denied, unavailable, timeout]).size).toBe(3);
  });
});

describe("correction audit XLSX", () => {
  it("always includes the Correction Audit sheet in the recap workbook", async () => {
    const workbook = await loadWorkbook(
      await buildRecapWorkbook(recap, context, []),
    );
    const sheet = requireSheet(workbook, "Correction Audit");
    expect(sheetText(sheet)).toContain("No manual corrections");
  });

  it("writes audit reasons into the recap Correction Audit sheet", async () => {
    const workbook = await loadWorkbook(
      await buildRecapWorkbook(recap, context, [audit]),
    );
    const sheet = requireSheet(workbook, "Correction Audit");
    const body = sheetText(sheet);
    expect(body).toContain("Budi Santoso");
    expect(body).toContain("GPS accuracy too poor");
    expect(body).toContain("physical");
  });

  it("includes only this meeting's audits in the meeting workbook", async () => {
    const workbook = await loadWorkbook(
      await buildMeetingWorkbook(detail, context, [
        audit,
        { ...audit, id: "audit-2", sessionId: "meeting-2" },
      ]),
    );
    const sheet = requireSheet(workbook, "Correction Audit");
    const body = sheetText(sheet);
    expect(body).toContain("Budi Santoso");
    expect(body.match(/Budi Santoso/g)?.length).toBe(1);
  });
});

describe("attendance PDF report", () => {
  it("produces a non-empty PDF document", async () => {
    const bytes = await buildAttendanceReportPdf(recap, context, [audit]);
    expect(bytes.length).toBeGreaterThan(100);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("does not require audits to build", async () => {
    const bytes = await buildAttendanceReportPdf(recap, context);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
