import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type {
  AttendanceMeetingDetail,
  AttendanceMeetingListItem,
  AttendanceRecap,
} from "@/lib/attendance/meeting-types";
import {
  buildAttendanceRecap,
  type AttendanceRecapCell,
} from "@/lib/attendance/recap";

import {
  buildChecklistWorkbook,
  buildMeetingWorkbook,
  buildRecapWorkbook,
  type AttendanceExportContext,
} from "@/features/attendance-meetings/excel";
import {
  buildChecklistFilename,
  buildMeetingFilename,
  buildRecapFilename,
  resolveRecapYear,
} from "@/features/attendance-meetings/filenames";

const GENERATED_AT = new Date("2026-02-20T10:30:00+07:00");

const context: AttendanceExportContext = {
  classInfo: {
    name: "TPLM002 — Interaksi Manusia dan Komputer",
    class_code: "TPLM002",
    course_name: "Interaksi Manusia dan Komputer",
    lecturer_name: "Dr. Sari Wulandari",
    semester: "Ganjil",
    academic_year: "2025/2026",
  },
  subject: {
    id: "subject-1",
    name: "Interaksi Manusia dan Komputer",
    code: "IMK",
    lecturerName: "Dr. Sari Wulandari",
    semester: "Ganjil",
    academicYear: "2025/2026",
  },
  generatedAt: GENERATED_AT,
};

function meetingListItem(
  overrides: Partial<AttendanceMeetingListItem> = {},
): AttendanceMeetingListItem {
  return {
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
      expected: 3,
      present: 1,
      late: 0,
      excused: 0,
      sick: 0,
      absent: 1,
      notRecorded: 1,
      failed: 2,
    },
    ...overrides,
  };
}

const detail: AttendanceMeetingDetail = {
  ...meetingListItem(),
  roster: [
    {
      userId: "user-ani",
      fullName: "Ani Putri",
      nim: "221001",
      displayName: "Ani Putri",
      joinedAt: "2025-09-01T00:00:00+07:00",
      eligible: true,
      status: "present",
      method: "geo",
      checkedInAt: "2026-02-10T08:52:00+07:00",
      distanceM: 42.4,
      accuracyM: 8,
      note: null,
      reviewedAt: null,
      identityVerified: true,
    },
    {
      userId: "user-budi",
      fullName: "Budi Santoso",
      nim: "221002",
      displayName: "Budi Santoso",
      joinedAt: "2025-09-01T00:00:00+07:00",
      eligible: true,
      status: "absent",
      method: "system",
      checkedInAt: null,
      distanceM: null,
      accuracyM: null,
      note: null,
      reviewedAt: null,
      identityVerified: false,
    },
    {
      userId: "user-citra",
      fullName: "Citra Dewi",
      nim: "221003",
      displayName: "Citra Dewi",
      joinedAt: "2025-09-01T00:00:00+07:00",
      eligible: true,
      status: "not_recorded",
      method: null,
      checkedInAt: null,
      distanceM: null,
      accuracyM: null,
      note: null,
      reviewedAt: null,
      identityVerified: false,
    },
  ],
  failures: [],
};

function recapFixture(): AttendanceRecap {
  const meetings = [
    meetingListItem(),
    meetingListItem({
      sessionId: "meeting-2",
      meetingNumber: 2,
      meetingDate: "2026-02-17",
      title: "Evaluasi",
      startsAt: "2026-02-17T09:00:00+07:00",
      endsAt: "2026-02-17T11:00:00+07:00",
      opensAt: "2026-02-17T08:45:00+07:00",
      closesAt: "2026-02-17T09:15:00+07:00",
      openedAt: "2026-02-17T08:45:00+07:00",
      closedAt: "2026-02-17T09:15:00+07:00",
      finalizedAt: "2026-02-17T09:16:00+07:00",
    }),
  ];

  const roster = [
    {
      userId: "user-ani",
      fullName: "Ani Putri",
      nim: "221001",
      displayName: "Ani Putri",
      joinedAt: "2025-09-01T00:00:00+07:00",
    },
    {
      userId: "user-budi",
      fullName: "Budi Santoso",
      nim: "221002",
      displayName: "Budi Santoso",
      joinedAt: "2025-09-01T00:00:00+07:00",
    },
    {
      userId: "user-citra",
      fullName: "Citra Dewi",
      nim: "221003",
      displayName: "Citra Dewi",
      joinedAt: "2025-09-01T00:00:00+07:00",
    },
  ];

  const cells: AttendanceRecapCell[] = [
    {
      sessionId: "meeting-1",
      userId: "user-ani",
      eligible: true,
      status: "present",
    },
    {
      sessionId: "meeting-2",
      userId: "user-ani",
      eligible: true,
      status: "absent",
    },
    {
      sessionId: "meeting-1",
      userId: "user-budi",
      eligible: true,
      status: "late",
    },
    {
      sessionId: "meeting-2",
      userId: "user-budi",
      eligible: true,
      status: "excused",
    },
    {
      sessionId: "meeting-1",
      userId: "user-citra",
      eligible: true,
      status: "not_recorded",
    },
    {
      sessionId: "meeting-2",
      userId: "user-citra",
      eligible: true,
      status: "not_recorded",
    },
  ];

  return buildAttendanceRecap({ meetings, roster, cells });
}

async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  // ExcelJS declares its own `Buffer extends ArrayBuffer` type, which Node's
  // Buffer no longer structurally satisfies.
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);

  return workbook;
}

function requireSheet(
  workbook: ExcelJS.Workbook,
  name: string,
): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(name);

  if (!sheet) {
    throw new Error(`Expected a worksheet named "${name}"`);
  }

  return sheet;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  let headerRow = 0;

  sheet.eachRow((row, rowNumber) => {
    if (headerRow === 0 && row.getCell(1).value === "No.") {
      headerRow = rowNumber;
    }
  });

  if (headerRow === 0) {
    throw new Error("Could not find the table header row");
  }

  return headerRow;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number, width: number) {
  const row = sheet.getRow(rowNumber);

  return Array.from(
    { length: width },
    (_, index) => row.getCell(index + 1).value,
  );
}

function findRowStartingWith(sheet: ExcelJS.Worksheet, label: string): number {
  let match = 0;

  sheet.eachRow((row, rowNumber) => {
    if (match === 0 && row.getCell(1).value === label) {
      match = rowNumber;
    }
  });

  if (match === 0) {
    throw new Error(`Could not find a row starting with "${label}"`);
  }

  return match;
}

function columnLetter(column: number): string {
  let letters = "";
  let current = column;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    current = Math.floor((current - 1) / 26);
  }

  return letters;
}

function expectedFilterRange(
  headerRow: number,
  width: number,
  lastDataRow: number,
): string {
  return `A${headerRow}:${columnLetter(width)}${lastDataRow}`;
}

describe("attendance export filenames", () => {
  it("builds the expected per-meeting, recap, and checklist names", () => {
    expect(
      buildMeetingFilename({
        classCode: "TPLM002",
        className: "Interaksi Manusia dan Komputer",
        subjectCode: "IMK",
        subjectName: "Interaksi Manusia dan Komputer",
        meetingNumber: 1,
      }),
    ).toBe("TPLM002_IMK_Pertemuan_01.xlsx");

    expect(
      buildRecapFilename({
        classCode: "TPLM002",
        className: "Interaksi Manusia dan Komputer",
        subjectCode: "IMK",
        subjectName: "Interaksi Manusia dan Komputer",
        year: 2026,
      }),
    ).toBe("TPLM002_IMK_Attendance_Recap_2026.xlsx");

    expect(
      buildChecklistFilename({
        classCode: "TPLM002",
        className: "Interaksi Manusia dan Komputer",
        subjectCode: "IMK",
        subjectName: "Interaksi Manusia dan Komputer",
      }),
    ).toBe("TPLM002_IMK_Attendance_Checklist.xlsx");
  });

  it("falls back to sanitized names when codes are missing", () => {
    expect(
      buildMeetingFilename({
        classCode: null,
        className: "Teknik Informatika",
        subjectCode: null,
        subjectName: "Interaksi Manusia dan Komputer",
        meetingNumber: 12,
      }),
    ).toBe(
      "TEKNIK_INFORMATIKA_INTERAKSI_MANUSIA_DAN_KOMPUTER_Pertemuan_12.xlsx",
    );
  });

  it("resolves the recap year from the academic year", () => {
    expect(resolveRecapYear("2025/2026")).toBe(2026);
    expect(resolveRecapYear("Ganjil", new Date("2031-05-04T00:00:00Z"))).toBe(
      2031,
    );
  });
});

describe("per-meeting workbook", () => {
  it("lists every registered student with totals and a frozen filterable header", async () => {
    const workbook = await loadWorkbook(
      await buildMeetingWorkbook(detail, context),
    );
    const sheet = requireSheet(workbook, "Pertemuan 1");
    const headerRow = findHeaderRow(sheet);
    const width = 7;

    expect(rowValues(sheet, headerRow, width)).toEqual([
      "No.",
      "NIM",
      "Student name",
      "Check-in time",
      "Distance",
      "Status",
      "Notes",
    ]);

    const ani = rowValues(sheet, headerRow + 1, width);
    expect(ani.slice(0, 3)).toEqual([1, "221001", "Ani Putri"]);
    expect(String(ani[3])).toContain("08:52");
    expect(ani[4]).toBe("42 m");
    expect(ani[5]).toBe("Present");
    expect(ani[6]).toBe("");

    const budi = rowValues(sheet, headerRow + 2, width);
    expect(budi.slice(0, 3)).toEqual([2, "221002", "Budi Santoso"]);
    expect(budi[3]).toBe("—");
    expect(budi[5]).toBe("Absent");
    expect(budi[6]).toBe("Finalized without a check-in");

    const citra = rowValues(sheet, headerRow + 3, width);
    expect(citra.slice(0, 3)).toEqual([3, "221003", "Citra Dewi"]);
    expect(citra[5]).toBe("Not recorded");
    expect(citra[6]).toBe("Not finalized");

    const totalsRow = findRowStartingWith(sheet, "Totals");
    const totals = new Map<string, unknown>();
    const totalLabels = [
      "Registered students",
      "Present",
      "Late",
      "Excused",
      "Sick",
      "Absent",
      "Not recorded",
      "Failed verification attempts",
    ];

    totalLabels.forEach((label, index) => {
      const row = sheet.getRow(totalsRow + 1 + index);
      expect(row.getCell(1).value).toBe(label);
      totals.set(label, row.getCell(3).value);
    });

    expect(totals.get("Registered students")).toBe(3);
    expect(totals.get("Present")).toBe(1);
    expect(totals.get("Late")).toBe(0);
    expect(totals.get("Absent")).toBe(1);
    expect(totals.get("Not recorded")).toBe(1);
    expect(totals.get("Failed verification attempts")).toBe(2);

    expect(sheet.autoFilter).toBe(
      expectedFilterRange(headerRow, width, headerRow + detail.roster.length),
    );
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      ySplit: headerRow,
    });
    expect(sheet.pageSetup.printTitlesRow).toBe(`${headerRow}:${headerRow}`);
  });
});

describe("semester recap workbook", () => {
  it("exports a matrix with sheet codes (✓ I S A T) and numeric percentages", async () => {
    const recap = recapFixture();
    const workbook = await loadWorkbook(
      await buildRecapWorkbook(recap, context),
    );
    const sheet = requireSheet(workbook, "Summary");
    const headerRow = findHeaderRow(sheet);
    const width = 3 + recap.meetings.length + 6;
    const dataRow = headerRow + 3;

    expect(rowValues(sheet, headerRow, width)).toEqual([
      "No.",
      "NIM",
      "Nama Mahasiswa",
      "Pertemuan",
      "Pertemuan",
      "H",
      "I",
      "S",
      "A",
      "T",
      "%",
    ]);
    expect(rowValues(sheet, headerRow + 1, width).slice(3, 5)).toEqual([1, 2]);

    const ani = rowValues(sheet, dataRow, width);
    expect(ani.slice(0, 3)).toEqual([1, "221001", "Ani Putri"]);
    expect(ani.slice(3, 5)).toEqual(["✓", "A"]);
    expect(ani.slice(5)).toEqual([1, 0, 0, 1, 0, 50]);

    const budi = rowValues(sheet, dataRow + 1, width);
    expect(budi.slice(0, 3)).toEqual([2, "221002", "Budi Santoso"]);
    expect(budi.slice(3, 5)).toEqual(["T", "I"]);
    expect(budi.slice(5)).toEqual([0, 1, 0, 0, 1, 0]);

    const citra = rowValues(sheet, dataRow + 2, width);
    expect(citra.slice(0, 3)).toEqual([3, "221003", "Citra Dewi"]);
    // Meetings were finalized months ago, so NR counts as absent (no-show)
    // per the recap policy: NR older than 24h after finalization counts as
    // absent, matching buildAttendanceRecap. The sheet still shows NR.
    expect(citra.slice(3, 5)).toEqual(["NR", "NR"]);
    expect(citra.slice(5)).toEqual([0, 0, 0, 2, 0, 0]);

    const percentageCell = sheet.getRow(dataRow).getCell(width);
    expect(percentageCell.numFmt).toBe('0.0"%"');

    expect(sheet.autoFilter).toBe(
      expectedFilterRange(
        headerRow,
        width,
        dataRow + recap.students.length - 1,
      ),
    );
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      ySplit: dataRow,
    });
    expect(sheet.pageSetup.printTitlesRow).toBe(
      `${headerRow}:${headerRow + 2}`,
    );
  });
});

describe("manual checklist workbook", () => {
  it("keeps fillable cells empty with P/L/I/S/A validation and a reference sheet", async () => {
    const recap = recapFixture();
    const workbook = await loadWorkbook(
      await buildChecklistWorkbook(recap, context),
    );
    const sheet = requireSheet(workbook, "Checklist");
    const headerRow = findHeaderRow(sheet);
    const width = 3 + recap.meetings.length;

    expect(rowValues(sheet, headerRow, width)).toEqual([
      "No.",
      "NIM",
      "Student name",
      "Pertemuan 1",
      "Pertemuan 2",
    ]);

    const warning = sheet.getRow(headerRow - 2).getCell(1).value;
    expect(String(warning)).toContain("Manual checklist template");

    for (let index = 0; index < recap.students.length; index += 1) {
      const rowValuesForStudent = rowValues(
        sheet,
        headerRow + 1 + index,
        width,
      );
      expect(rowValuesForStudent[0]).toBe(index + 1);
      expect(rowValuesForStudent.slice(3)).toEqual(
        recap.meetings.map(() => null),
      );
    }

    const firstFillableCell = sheet.getRow(headerRow + 1).getCell(4);
    expect(firstFillableCell.dataValidation?.type).toBe("list");
    expect(firstFillableCell.dataValidation?.formulae).toEqual(['"P,L,I,S,A"']);

    const existing = requireSheet(workbook, "Existing records");
    const existingHeader = findHeaderRow(existing);
    const reference = rowValues(existing, existingHeader + 1, width);

    expect(reference.slice(0, 3)).toEqual([1, "221001", "Ani Putri"]);
    expect(reference.slice(3)).toEqual(["P", "A"]);
  });
});
