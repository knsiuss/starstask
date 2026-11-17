import "server-only";

import ExcelJS from "exceljs";

import {
  ATTENDANCE_MEETING_CELL_LABELS,
  ATTENDANCE_MEETING_CELL_SYMBOLS,
  type AttendanceMeetingCellStatus,
} from "@starstask/contracts";

import {
  COURSE_GRADE_COMPONENTS,
  type ExportBrandingInput,
} from "@starstask/contracts";

import type {
  AttendanceCorrectionAuditEntry,
  AttendanceMeetingDetail,
  AttendanceMeetingRosterEntry,
  AttendanceRecap,
} from "@/lib/attendance/meeting-types";
import type { ClassSummary } from "@/lib/db/classes";
import type { CourseComponentGrades } from "@/lib/db/course-grades";
import { addBrandingFooterNote, addBrandingHeader } from "./excel-header";

const TIME_ZONE = "Asia/Jakarta";
const HEADER_FILL = "FF0F172A";
const BORDER_COLOR = "FFCBD5E1";
const MUTED_TEXT = "FF64748B";

const STATUS_FILLS: Record<AttendanceMeetingCellStatus, string> = {
  present: "FFDCFCE7",
  late: "FFFEF3C7",
  excused: "FFDBEAFE",
  sick: "FFCFFAFE",
  absent: "FFFEE2E2",
  not_recorded: "FFF1F5F9",
  not_applicable: "FFF8FAFC",
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
  timeZoneName: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

export type AttendanceExportClass = Pick<
  ClassSummary,
  | "name"
  | "class_code"
  | "course_name"
  | "lecturer_name"
  | "semester"
  | "academic_year"
>;

export type AttendanceExportSubject = {
  id: string;
  name: string;
  code: string | null;
  lecturerName: string | null;
  semester: string;
  academicYear: string;
};

export type AttendanceExportContext = {
  classInfo: AttendanceExportClass;
  subject: AttendanceExportSubject;
  generatedAt: Date;
};

/** One-meeting attendance report with every registered student. */
export async function buildMeetingWorkbook(
  detail: AttendanceMeetingDetail,
  context: AttendanceExportContext,
  audits: AttendanceCorrectionAuditEntry[] = [],
): Promise<Uint8Array> {
  const workbook = createWorkbook(context.generatedAt);
  const sheet = workbook.addWorksheet(`Pertemuan ${detail.meetingNumber}`, {
    pageSetup: landscapePageSetup(),
  });

  sheet.columns = [
    { key: "no", width: 7 },
    { key: "nim", width: 20 },
    { key: "name", width: 32 },
    { key: "checkedInAt", width: 24 },
    { key: "distance", width: 12 },
    { key: "status", width: 16 },
    { key: "notes", width: 38 },
  ];

  let row = addReportHeading(
    sheet,
    "Attendance Report",
    `Pertemuan ${detail.meetingNumber} — ${context.subject.name}`,
  );

  row = addMetadataRows(sheet, row, 7, [
    ["Class", context.classInfo.name],
    ["Class code", context.classInfo.class_code ?? "—"],
    ["Subject", subjectLabel(context.subject)],
    ["Lecturer", subjectLecturer(context)],
    ["Semester", context.subject.semester],
    ["Academic year", context.subject.academicYear],
    ["Meeting number", `Pertemuan ${detail.meetingNumber}`],
    ["Meeting date", formatMeetingDate(detail.meetingDate, detail.startsAt)],
    [
      "Meeting time",
      `${formatDateTime(detail.startsAt)} – ${formatDateTime(detail.endsAt)}`,
    ],
    ["Location", detail.location ?? "—"],
    ["Allowed radius", `${detail.radiusM} m`],
    [
      "Attendance window",
      `${formatDateTime(detail.opensAt ?? detail.startsAt)} – ${formatDateTime(detail.closesAt ?? detail.endsAt)}`,
    ],
    ["Exported at", formatDateTime(context.generatedAt.toISOString())],
  ]);

  const headerRow = sheet.getRow(row);
  headerRow.values = [
    "No.",
    "NIM",
    "Student name",
    "Check-in time",
    "Distance",
    "Status",
    "Notes",
  ];
  styleHeaderRow(headerRow, 7);
  const headerRowNumber = row;

  const firstDataRow = headerRowNumber + 1;

  detail.roster.forEach((entry, index) => {
    const dataRow = sheet.getRow(firstDataRow + index);
    dataRow.values = [
      index + 1,
      entry.nim ?? "—",
      entry.fullName,
      entry.checkedInAt ? formatDateTime(entry.checkedInAt) : "—",
      entry.distanceM === null ? "—" : `${Math.round(entry.distanceM)} m`,
      ATTENDANCE_MEETING_CELL_LABELS[entry.status],
      rosterNote(entry),
    ];
    styleDataRow(dataRow, 7);

    const statusCell = dataRow.getCell(6);
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STATUS_FILLS[entry.status] },
    };
  });

  const lastDataRow = firstDataRow + detail.roster.length - 1;

  if (detail.roster.length === 0) {
    const emptyRow = sheet.getRow(firstDataRow);
    emptyRow.getCell(1).value = "No registered students in this class yet.";
    sheet.mergeCells(firstDataRow, 1, firstDataRow, 7);
    emptyRow.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  }

  const totalsStart = Math.max(lastDataRow, firstDataRow) + 2;

  addTotalsBlock(sheet, totalsStart, [
    ["Registered students", detail.counts.expected],
    ["Present", detail.counts.present],
    ["Late", detail.counts.late],
    ["Excused", detail.counts.excused],
    ["Sick", detail.counts.sick],
    ["Absent", detail.counts.absent],
    ["Not recorded", detail.counts.notRecorded],
    ["Failed verification attempts", detail.counts.failed],
  ]);

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: Math.max(lastDataRow, firstDataRow), column: 7 },
  };
  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
  sheet.headerFooter.oddFooter = "&LStarsTask&C&P / &N&RAttendance report";

  addCorrectionAuditSheet(
    workbook,
    audits.filter((entry) => entry.sessionId === detail.sessionId),
    context,
  );

  return workbookToBytes(workbook);
}

const SHEET_CELL_CODES: Record<AttendanceMeetingCellStatus, string> = {
  present: "✓",
  late: "T",
  excused: "I",
  sick: "S",
  absent: "A",
  not_recorded: "NR",
  not_applicable: "—",
};

const SHEET_CELL_LABELS_ID: Record<string, string> = {
  present: "Hadir",
  late: "Terlambat",
  excused: "Izin",
  sick: "Sakit",
  absent: "Alfa (Tidak Hadir)",
};

const meetingDateLabel = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  timeZone: TIME_ZONE,
});

/**
 * Semester attendance sheet, styled after the campus printout: students are
 * rows, meetings are columns that grow to the right, and each cell is a text
 * code (✓ I S A T). Totals use the sheet formula H / total meetings.
 */
export type RecapExportExtras = {
  branding?: ExportBrandingInput;
  grades?: CourseComponentGrades;
};

const GRADE_HEADERS = ["Tugas", "UTS", "UAS", "Nilai Akhir"] as const;
const GRADE_COLUMN_COUNT = 4;
const GRADE_NUM_FMT = "0.0";

export async function buildRecapWorkbook(
  recap: AttendanceRecap,
  context: AttendanceExportContext,
  audits: AttendanceCorrectionAuditEntry[] = [],
  extras: RecapExportExtras = {},
): Promise<Uint8Array> {
  const workbook = createWorkbook(context.generatedAt);
  const sheet = workbook.addWorksheet("Summary", {
    pageSetup: landscapePageSetup(),
  });
  const meetingCount = recap.meetings.length;
  // Branding without `brandingEnabled` falls back to the legacy sheet.
  const branding = extras.branding?.brandingEnabled ? extras.branding : null;
  const grades = extras.grades;
  const gradeColumnCount = grades ? GRADE_COLUMN_COUNT : 0;
  const totalColumns = 3 + meetingCount + 6 + gradeColumnCount;
  const firstMeetingColumn = 4;
  const firstTotalColumn = 4 + meetingCount;
  // The branding header occupies rows 1–5, shifting the course block down by
  // four rows (the legacy title bar alone filled row 1).
  const rowShift = branding ? 4 : 0;

  sheet.columns = [
    { key: "no", width: 7 },
    { key: "nim", width: 18 },
    { key: "name", width: 30 },
    ...recap.meetings.map(() => ({ width: 9 })),
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 12 },
    ...Array.from({ length: gradeColumnCount }, () => ({ width: 11 })),
  ];

  const darkFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  } as const;
  const thinBorder = {
    top: { style: "thin", color: { argb: BORDER_COLOR } },
    left: { style: "thin", color: { argb: BORDER_COLOR } },
    bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    right: { style: "thin", color: { argb: BORDER_COLOR } },
  } as const;

  // Title bar — the branding header when configured, the legacy title otherwise.
  if (branding) {
    await addBrandingHeader(sheet, branding, context, totalColumns);
  } else {
    sheet.mergeCells(1, 1, 1, totalColumns);
    const titleCell = sheet.getRow(1).getCell(1);
    titleCell.value = "★ StarsTask — Absensi Mata Kuliah";
    titleCell.font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = darkFill;
    titleCell.alignment = { vertical: "middle" };
    sheet.getRow(1).height = 26;
  }

  // Course block (left) and summary stats (right), from real class data.
  const courseRowNumber = 3 + rowShift;
  const courseRow = sheet.getRow(courseRowNumber);
  sheet.mergeCells(courseRowNumber, 1, courseRowNumber, 3);
  courseRow.getCell(1).value = subjectLabel(context.subject);
  courseRow.getCell(1).font = { size: 16, bold: true };
  sheet.mergeCells(courseRowNumber + 1, 1, courseRowNumber + 1, 3);
  courseRow.getCell(1).value = context.subject.name;
  courseRow.getCell(1).font = { size: 11, color: { argb: MUTED_TEXT } };

  const infoRows = [5 + rowShift, 6 + rowShift, 7 + rowShift];
  const infoValues = [
    `Kelas  : ${context.classInfo.class_code ?? context.classInfo.name}`,
    `Dosen  : ${subjectLecturer(context)}`,
    `Semester  : ${context.subject.semester} ${context.subject.academicYear}`,
  ];
  infoRows.forEach((rowNumber, index) => {
    sheet.mergeCells(rowNumber, 1, rowNumber, 3);
    sheet.getRow(rowNumber).getCell(1).value = infoValues[index];
  });

  const percentages = recap.students.map((student) =>
    meetingCount === 0
      ? null
      : Math.round((student.totals.present / meetingCount) * 1_000) / 10,
  );
  const presentPercentages = percentages.filter(
    (value): value is number => value !== null,
  );
  const average =
    presentPercentages.length === 0
      ? null
      : presentPercentages.reduce((sum, value) => sum + value, 0) /
        presentPercentages.length;

  const stats: [string, string | number][] = [
    ["Jumlah Mahasiswa", recap.students.length],
    ["Total Pertemuan", meetingCount],
    [
      "Rata-rata Kehadiran",
      average === null ? "—" : `${average.toFixed(1).replace(".", ",")}%`,
    ],
  ];
  const statsStartColumn = Math.max(4, totalColumns - 5);

  stats.forEach(([label, value], index) => {
    const column = statsStartColumn + index * 2;
    const labelRow = sheet.getRow(courseRowNumber);
    const valueRow = sheet.getRow(courseRowNumber + 1);
    sheet.mergeCells(3, column, 3, column + 1);
    sheet.mergeCells(4, column, 4, column + 1);
    labelRow.getCell(column).value = label;
    labelRow.getCell(column).font = {
      size: 9,
      color: { argb: MUTED_TEXT },
    };
    valueRow.getCell(column).value = value;
    valueRow.getCell(column).font = { size: 16, bold: true };
    // Light card fill behind each stat, like the printed reference.
    for (const statRow of [labelRow, valueRow]) {
      statRow.getCell(column).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
      statRow.getCell(column + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      };
    }
  });

  // Two-row header: group row + meeting numbers/dates.
  const groupRowNumber = 9 + rowShift;
  const headerRowNumber = 10 + rowShift;
  const groupRow = sheet.getRow(groupRowNumber);
  const headerRow = sheet.getRow(headerRowNumber);
  const fixedHeaders = ["No.", "NIM", "Nama Mahasiswa"];
  const totalHeaders = ["H", "I", "S", "A", "T", "%"];

  fixedHeaders.forEach((label, index) => {
    const column = index + 1;
    sheet.mergeCells(groupRowNumber, column, headerRowNumber, column);
    groupRow.getCell(column).value = label;
  });

  if (meetingCount > 0) {
    sheet.mergeCells(
      groupRowNumber,
      firstMeetingColumn,
      groupRowNumber,
      firstMeetingColumn + meetingCount - 1,
    );
    groupRow.getCell(firstMeetingColumn).value = "Pertemuan";
    groupRow.getCell(firstMeetingColumn).alignment = {
      horizontal: "center",
    };
    recap.meetings.forEach((meeting, index) => {
      const column = firstMeetingColumn + index;
      headerRow.getCell(column).value = meeting.meetingNumber;
      headerRow.getCell(column).alignment = { horizontal: "center" };
      const dateRow = sheet.getRow(headerRowNumber + 1);
      dateRow.getCell(column).value = meetingDateLabel.format(
        new Date(meeting.startsAt),
      );
      dateRow.getCell(column).alignment = { horizontal: "center" };
      dateRow.getCell(column).font = {
        size: 9,
        color: { argb: MUTED_TEXT },
      };
    });
  }

  totalHeaders.forEach((label, index) => {
    const column = firstTotalColumn + index;
    sheet.mergeCells(groupRowNumber, column, headerRowNumber, column);
    groupRow.getCell(column).value = label;
  });

  if (grades) {
    GRADE_HEADERS.forEach((label, index) => {
      const column = firstTotalColumn + totalHeaders.length + index;
      sheet.mergeCells(groupRowNumber, column, headerRowNumber, column);
      groupRow.getCell(column).value = label;
    });
  }

  for (const row of [groupRow, headerRow]) {
    row.height = 20;
    for (let column = 1; column <= totalColumns; column += 1) {
      const cell = row.getCell(column);
      cell.fill = darkFill;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = thinBorder;
    }
  }
  sheet.getRow(headerRowNumber + 1).height = 14;
  for (let column = 1; column <= totalColumns; column += 1) {
    const cell = sheet.getRow(headerRowNumber + 1).getCell(column);
    cell.fill = darkFill;
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  // Fixed header names stay left-aligned under the dark fill.
  fixedHeaders.forEach((_, index) => {
    const cell = groupRow.getCell(index + 1);
    cell.alignment = { horizontal: "left", vertical: "middle" };
  });

  const firstDataRow = headerRowNumber + 2;

  recap.students.forEach((student, index) => {
    const dataRow = sheet.getRow(firstDataRow + index);
    const percentage =
      meetingCount === 0
        ? null
        : Math.round((student.totals.present / meetingCount) * 1_000) / 10;
    const values: (string | number | null)[] = [
      index + 1,
      student.nim ?? "—",
      student.fullName,
      ...recap.meetings.map(
        (meeting) =>
          SHEET_CELL_CODES[
            student.cells[meeting.sessionId] ?? "not_applicable"
          ],
      ),
      student.totals.present,
      student.totals.excused,
      student.totals.sick,
      student.totals.absent,
      student.totals.late,
      percentage === null ? "—" : percentage,
    ];

    // Grade columns stay blank when a component has no recorded score, so
    // the final grade never invents a zero the lecturer did not enter.
    const gradeValues: (string | number | null)[] = [];

    if (grades) {
      const scores = COURSE_GRADE_COMPONENTS.map(
        (component) => grades[`${student.userId}:${component}`],
      );
      const presentScores = scores.filter(
        (score): score is number =>
          typeof score === "number" && Number.isFinite(score),
      );
      const finalGrade =
        presentScores.length === 0
          ? null
          : presentScores.reduce((sum, score) => sum + score, 0) /
            presentScores.length;

      gradeValues.push(
        scores[0] ?? null,
        scores[1] ?? null,
        scores[2] ?? null,
        finalGrade,
      );
    }

    dataRow.values = [...values, ...gradeValues];
    dataRow.height = 18;

    for (let column = 1; column <= totalColumns; column += 1) {
      const cell = dataRow.getCell(column);
      cell.border = thinBorder;
      cell.font = { size: 11 };
      // Subtle striping on the identity/total cells; meeting cells keep
      // their status fill below.
      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    }

    dataRow.getCell(1).alignment = { horizontal: "center" };

    recap.meetings.forEach((meeting, meetingIndex) => {
      const status = student.cells[meeting.sessionId] ?? "not_applicable";
      const cell = dataRow.getCell(firstMeetingColumn + meetingIndex);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STATUS_FILLS[status] },
      };
      cell.font = { bold: status === "present", size: 11 };
    });

    for (let column = firstTotalColumn; column < totalColumns; column += 1) {
      dataRow.getCell(column).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    }

    const percentageColumn = firstTotalColumn + totalHeaders.length - 1;
    const percentageCell = dataRow.getCell(percentageColumn);
    percentageCell.alignment = { horizontal: "right", vertical: "middle" };
    percentageCell.numFmt = '0.0"%"';
    percentageCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    percentageCell.font = { bold: true, size: 11 };

    if (grades) {
      for (let offset = 0; offset < GRADE_COLUMN_COUNT; offset += 1) {
        const gradeCell = dataRow.getCell(percentageColumn + 1 + offset);
        gradeCell.alignment = { horizontal: "center", vertical: "middle" };
        gradeCell.numFmt = GRADE_NUM_FMT;
      }
    }
  });

  const lastDataRow = firstDataRow + recap.students.length - 1;

  if (recap.students.length === 0) {
    const emptyRow = sheet.getRow(firstDataRow);
    emptyRow.getCell(1).value = "No registered students in this class yet.";
    sheet.mergeCells(firstDataRow, 1, firstDataRow, totalColumns);
    emptyRow.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  }

  // Legend + notes, matching the printed sheet.
  const legendRowNumber = Math.max(lastDataRow, firstDataRow) + 2;
  sheet.mergeCells(legendRowNumber, 1, legendRowNumber, totalColumns);
  sheet.getRow(legendRowNumber).getCell(1).value = "Keterangan Kode Absen:";
  sheet.getRow(legendRowNumber).getCell(1).font = { bold: true, size: 11 };

  const legendStatuses = [
    "present",
    "excused",
    "sick",
    "absent",
    "late",
  ] as const;
  const legendRow = sheet.getRow(legendRowNumber + 1);
  let legendColumn = 1;

  for (const status of legendStatuses) {
    const codeCell = legendRow.getCell(legendColumn);
    codeCell.value = SHEET_CELL_CODES[status];
    codeCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STATUS_FILLS[status] },
    };
    codeCell.font = { bold: true, size: 11 };
    codeCell.alignment = { horizontal: "center" };
    codeCell.border = thinBorder;
    legendColumn += 1;
    legendRow.getCell(legendColumn).value = `= ${SHEET_CELL_LABELS_ID[status]}`;
    legendRow.getCell(legendColumn).font = { size: 11 };
    legendColumn += 2;
  }

  const noteRowNumber = legendRowNumber + 3;
  sheet.mergeCells(noteRowNumber, 1, noteRowNumber, totalColumns);
  sheet.getRow(noteRowNumber).getCell(1).value = "Catatan:";
  sheet.getRow(noteRowNumber).getCell(1).font = { bold: true, size: 11 };
  sheet.mergeCells(noteRowNumber + 1, 1, noteRowNumber + 1, totalColumns);
  sheet.getRow(noteRowNumber + 1).getCell(1).value =
    "• H = Hadir, I = Izin, S = Sakit, A = Alfa, T = Terlambat.";
  sheet.mergeCells(noteRowNumber + 2, 1, noteRowNumber + 2, totalColumns);
  sheet.getRow(noteRowNumber + 2).getCell(1).value =
    "• Persentase = (H / Total Pertemuan) × 100%.";
  sheet.mergeCells(noteRowNumber + 3, 1, noteRowNumber + 3, totalColumns);
  sheet.getRow(noteRowNumber + 3).getCell(1).value =
    `• Exported at ${formatDateTime(context.generatedAt.toISOString())} via StarsTask.`;
  for (let offset = 1; offset <= 3; offset += 1) {
    sheet.getRow(noteRowNumber + offset).getCell(1).font = { size: 10 };
  }

  let summaryRow = noteRowNumber + 5;

  if (grades) {
    summaryRow = addGradeSummary(sheet, summaryRow, recap, grades);
  }

  if (grades && branding) {
    summaryRow = addAttendanceGraduationSummary(
      sheet,
      summaryRow,
      recap,
      grades,
      branding.passingThreshold,
    );
  }

  if (branding) {
    addBrandingFooterNote(
      sheet,
      summaryRow,
      totalColumns,
      branding,
      formatDateTime(context.generatedAt.toISOString()),
    );
  }

  sheet.autoFilter = {
    from: { row: groupRowNumber, column: 1 },
    to: {
      row: Math.max(lastDataRow, firstDataRow),
      column: totalColumns,
    },
  };
  sheet.views = [{ state: "frozen", ySplit: firstDataRow }];
  sheet.pageSetup.printTitlesRow = `${groupRowNumber}:${headerRowNumber + 1}`;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;

  // Correction Audit sheet: every audited manual correction for the subject.
  addCorrectionAuditSheet(workbook, audits, context);

  return workbookToBytes(workbook);
}

function addCorrectionAuditSheet(
  workbook: ExcelJS.Workbook,
  audits: AttendanceCorrectionAuditEntry[],
  context: AttendanceExportContext,
): void {
  const sheet = workbook.addWorksheet("Correction Audit", {
    pageSetup: landscapePageSetup(),
  });

  sheet.columns = [
    { key: "no", width: 7 },
    { key: "nim", width: 20 },
    { key: "student", width: 28 },
    { key: "meeting", width: 16 },
    { key: "previous", width: 14 },
    { key: "next", width: 14 },
    { key: "admin", width: 24 },
    { key: "reason", width: 40 },
    { key: "method", width: 14 },
    { key: "at", width: 24 },
  ];

  let row = addReportHeading(
    sheet,
    "Correction Audit",
    `Manual corrections — ${subjectLabel(context.subject)}`,
  );

  row = addMetadataRows(sheet, row, 10, [
    ["Exported at", formatDateTime(context.generatedAt.toISOString())],
  ]);

  const headerRowNumber = row;
  const headerRow = sheet.getRow(headerRowNumber);
  const headerValues = [
    "No.",
    "Student NIM",
    "Student name",
    "Meeting",
    "Previous status",
    "New status",
    "Admin",
    "Reason",
    "Verification method",
    "Corrected at",
  ];
  headerRow.values = headerValues;
  styleHeaderRow(headerRow, headerValues.length);

  const firstDataRow = headerRowNumber + 1;

  audits.forEach((entry, index) => {
    const dataRow = sheet.getRow(firstDataRow + index);
    const values: (string | number)[] = [
      index + 1,
      entry.studentNim ?? "—",
      entry.studentName,
      entry.meetingNumber !== null ? `Pertemuan ${entry.meetingNumber}` : "—",
      entry.previousStatus,
      entry.newStatus,
      entry.adminName,
      entry.reason,
      entry.physicallyVerified ? "physical" : entry.verificationMethod,
      formatDateTime(entry.createdAt),
    ];
    dataRow.values = values;
    styleDataRow(dataRow, values.length);
  });

  if (audits.length === 0) {
    const emptyRow = sheet.getRow(firstDataRow);
    emptyRow.getCell(1).value =
      "No manual corrections recorded for this scope.";
    sheet.mergeCells(firstDataRow, 1, firstDataRow, headerValues.length);
    emptyRow.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  }

  const lastDataRow = firstDataRow + audits.length - 1;

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: {
      row: Math.max(lastDataRow, firstDataRow),
      column: headerValues.length,
    },
  };
  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
}

/**
 * Blank manual checklist. It never contains official records on the fillable
 * sheet; a second sheet repeats the verified matrix as a read-only reference.
 */
export async function buildChecklistWorkbook(
  recap: AttendanceRecap,
  context: AttendanceExportContext,
): Promise<Uint8Array> {
  const workbook = createWorkbook(context.generatedAt);
  const sheet = workbook.addWorksheet("Checklist", {
    pageSetup: landscapePageSetup(),
  });

  sheet.columns = [
    { key: "no", width: 7 },
    { key: "nim", width: 20 },
    { key: "name", width: 32 },
    ...recap.meetings.map(() => ({ width: 11 })),
  ];

  let row = addReportHeading(
    sheet,
    "Manual Attendance Checklist",
    subjectLabel(context.subject),
  );

  row = addMetadataRows(sheet, row, 3 + recap.meetings.length, [
    ["Class", context.classInfo.name],
    ["Class code", context.classInfo.class_code ?? "—"],
    ["Subject", subjectLabel(context.subject)],
    ["Lecturer", subjectLecturer(context)],
    ["Semester", context.subject.semester],
    ["Academic year", context.subject.academicYear],
    ["Meetings", String(recap.meetings.length)],
    ["Generated at", formatDateTime(context.generatedAt.toISOString())],
  ]);

  const warningRow = sheet.getRow(row);
  warningRow.getCell(1).value =
    "Manual checklist template — not an official attendance report. Official records are never changed by this file.";
  sheet.mergeCells(row, 1, row, 3 + recap.meetings.length);
  warningRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };
  warningRow.getCell(1).font = { bold: true, color: { argb: "FF92400E" } };
  warningRow.getCell(1).alignment = {
    wrapText: true,
    vertical: "middle",
  };
  warningRow.height = 30;
  row += 2;

  const headerRowNumber = row;
  const headerRow = sheet.getRow(headerRowNumber);
  const headerValues: (string | number)[] = [
    "No.",
    "NIM",
    "Student name",
    ...recap.meetings.map((meeting) => `Pertemuan ${meeting.meetingNumber}`),
  ];
  headerRow.values = headerValues;
  styleHeaderRow(headerRow, headerValues.length);

  const firstDataRow = headerRowNumber + 1;

  recap.students.forEach((student, index) => {
    const dataRow = sheet.getRow(firstDataRow + index);
    dataRow.values = [index + 1, student.nim ?? "—", student.fullName];
    styleDataRow(dataRow, headerValues.length);
    dataRow.height = 22;
  });

  const lastDataRow = Math.max(
    firstDataRow + recap.students.length - 1,
    firstDataRow,
  );

  if (recap.students.length === 0) {
    const emptyRow = sheet.getRow(firstDataRow);
    emptyRow.getCell(1).value = "No registered students in this class yet.";
    sheet.mergeCells(firstDataRow, 1, firstDataRow, headerValues.length);
    emptyRow.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  }

  if (recap.meetings.length > 0 && recap.students.length > 0) {
    const startColumn = 4;
    const endColumn = 3 + recap.meetings.length;

    for (let dataRow = firstDataRow; dataRow <= lastDataRow; dataRow += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        sheet.getRow(dataRow).getCell(column).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"P,L,I,S,A"'],
          showErrorMessage: true,
          errorTitle: "Use a checklist code",
          error: "Choose P, L, I, S, or A.",
        };
      }
    }
  }

  const legendRow = lastDataRow + 2;
  const noteRow = addLegend(sheet, legendRow, headerValues.length, true);
  addAttendanceNote(sheet, noteRow, headerValues.length, true);

  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

  addExistingRecordsSheet(workbook, recap, context);

  return workbookToBytes(workbook);
}

function addExistingRecordsSheet(
  workbook: ExcelJS.Workbook,
  recap: AttendanceRecap,
  context: AttendanceExportContext,
): void {
  const sheet = workbook.addWorksheet("Existing records", {
    pageSetup: landscapePageSetup(),
  });

  sheet.columns = [
    { width: 7 },
    { width: 20 },
    { width: 32 },
    ...recap.meetings.map(() => ({ width: 11 })),
  ];

  let row = addReportHeading(
    sheet,
    "Verified Records (Reference Only)",
    subjectLabel(context.subject),
  );

  const noteRow = sheet.getRow(row);
  noteRow.getCell(1).value =
    "Reference only. This sheet is not editable and does not replace the official record.";
  sheet.mergeCells(row, 1, row, 3 + recap.meetings.length);
  noteRow.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  noteRow.getCell(1).alignment = { wrapText: true };
  row += 2;

  const headerRowNumber = row;
  const headerRow = sheet.getRow(headerRowNumber);
  const headerValues: (string | number)[] = [
    "No.",
    "NIM",
    "Student name",
    ...recap.meetings.map((meeting) => `Pertemuan ${meeting.meetingNumber}`),
  ];
  headerRow.values = headerValues;
  styleHeaderRow(headerRow, headerValues.length);

  recap.students.forEach((student, index) => {
    const dataRow = sheet.getRow(headerRowNumber + 1 + index);
    dataRow.values = [
      index + 1,
      student.nim ?? "—",
      student.fullName,
      ...recap.meetings.map(
        (meeting) =>
          ATTENDANCE_MEETING_CELL_SYMBOLS[
            student.cells[meeting.sessionId] ?? "not_applicable"
          ],
      ),
    ];
    styleDataRow(dataRow, headerValues.length);

    recap.meetings.forEach((meeting, meetingIndex) => {
      const status = student.cells[meeting.sessionId] ?? "not_applicable";
      const cell = dataRow.getCell(4 + meetingIndex);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STATUS_FILLS[status] },
      };
    });
  });

  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
}

function createWorkbook(generatedAt: Date): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StarsTask";
  workbook.lastModifiedBy = "StarsTask";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  return workbook;
}

/** Writes the StarsTask heading and returns the next free row. */
function addReportHeading(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
): number {
  const heading = sheet.getRow(1);
  heading.getCell(1).value = "StarsTask";
  heading.getCell(1).font = {
    bold: true,
    size: 18,
    color: { argb: HEADER_FILL },
  };
  heading.height = 26;

  const titleRow = sheet.getRow(2);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { bold: true, size: 13 };
  sheet.mergeCells(2, 1, 2, 3);

  const subtitleRow = sheet.getRow(3);
  subtitleRow.getCell(1).value = subtitle;
  subtitleRow.getCell(1).font = { size: 11, color: { argb: MUTED_TEXT } };
  sheet.mergeCells(3, 1, 3, 3);

  return 5;
}

function addMetadataRows(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columnCount: number,
  rows: [string, string][],
): number {
  rows.forEach(([label, value], index) => {
    const row = sheet.getRow(startRow + index);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: MUTED_TEXT } };
    // The first data column is narrow ("No."), so the label spans it plus
    // the next column; the value starts after that.
    sheet.mergeCells(startRow + index, 1, startRow + index, 2);
    row.getCell(3).value = value;
    sheet.mergeCells(startRow + index, 3, startRow + index, columnCount);
  });

  return startRow + rows.length + 1;
}

function studentFinalGrades(
  recap: AttendanceRecap,
  grades: CourseComponentGrades,
): (number | null)[] {
  return recap.students.map((student) => {
    const presentScores = COURSE_GRADE_COMPONENTS.flatMap((component) => {
      const score = grades[`${student.userId}:${component}`];

      return typeof score === "number" && Number.isFinite(score) ? [score] : [];
    });

    if (presentScores.length === 0) {
      return null;
    }

    return (
      presentScores.reduce((sum, score) => sum + score, 0) /
      presentScores.length
    );
  });
}

function componentScores(
  recap: AttendanceRecap,
  grades: CourseComponentGrades,
  component: (typeof COURSE_GRADE_COMPONENTS)[number],
): number[] {
  const scores: number[] = [];

  for (const student of recap.students) {
    const score = grades[`${student.userId}:${component}`];

    if (typeof score === "number" && Number.isFinite(score)) {
      scores.push(score);
    }
  }

  return scores;
}

function averageOrDash(scores: number[]): number | string {
  if (scores.length === 0) {
    return "—";
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/** "Rekapitulasi Nilai": class-wide grade statistics, blanks ignored. */
function addGradeSummary(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  recap: AttendanceRecap,
  grades: CourseComponentGrades,
): number {
  const finals = studentFinalGrades(recap, grades).filter(
    (score): score is number => score !== null,
  );
  const rows: [string, number | string][] = [
    ["Rata-rata Tugas", averageOrDash(componentScores(recap, grades, "tugas"))],
    ["Rata-rata UTS", averageOrDash(componentScores(recap, grades, "uts"))],
    ["Rata-rata UAS", averageOrDash(componentScores(recap, grades, "uas"))],
    ["Rata-rata Nilai Akhir", averageOrDash(finals)],
    ["Rata-rata Kelas", averageOrDash(finals)],
    ["Nilai Tertinggi", finals.length === 0 ? "—" : Math.max(...finals)],
    ["Nilai Terendah", finals.length === 0 ? "—" : Math.min(...finals)],
  ];

  addSummaryBlock(sheet, startRow, "Rekapitulasi Nilai", rows);

  return startRow + rows.length + 2;
}

/** "Ringkasan Kehadiran & Kelulusan" against the configured threshold. */
function addAttendanceGraduationSummary(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  recap: AttendanceRecap,
  grades: CourseComponentGrades,
  passingThreshold: number,
): number {
  const meetingCount = recap.meetings.length;
  const finals = studentFinalGrades(recap, grades);
  const passed = finals.filter(
    (final) => final !== null && final >= passingThreshold,
  ).length;
  const notPassed = finals.filter(
    (final) => final !== null && final < passingThreshold,
  ).length;
  const attendance =
    meetingCount === 0 || recap.students.length === 0
      ? "—"
      : `${(
          (recap.students.reduce(
            (sum, student) => sum + student.totals.present,
            0,
          ) /
            (meetingCount * recap.students.length)) *
          100
        )
          .toFixed(1)
          .replace(".", ",")}%`;
  const rows: [string, number | string][] = [
    ["Total Mahasiswa", recap.students.length],
    ["Rata-rata Kehadiran", attendance],
    ["Lulus", passed],
    ["Tidak Lulus", notPassed],
  ];

  addSummaryBlock(sheet, startRow, "Ringkasan Kehadiran & Kelulusan", rows);

  return startRow + rows.length + 2;
}

function addSummaryBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  rows: [string, number | string][],
): void {
  sheet.getRow(startRow).getCell(1).value = title;
  sheet.getRow(startRow).getCell(1).font = { bold: true, size: 12 };

  rows.forEach(([label, value], index) => {
    const row = sheet.getRow(startRow + 1 + index);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: MUTED_TEXT } };
    sheet.mergeCells(startRow + 1 + index, 1, startRow + 1 + index, 2);
    row.getCell(3).value = value;
    if (typeof value === "number") {
      row.getCell(3).numFmt = GRADE_NUM_FMT;
    }
  });
}

function addTotalsBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  rows: [string, number][],
): void {
  const title = sheet.getRow(startRow);
  title.getCell(1).value = "Totals";
  title.getCell(1).font = { bold: true };

  rows.forEach(([label, value], index) => {
    const row = sheet.getRow(startRow + 1 + index);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: MUTED_TEXT } };
    sheet.mergeCells(startRow + 1 + index, 1, startRow + 1 + index, 2);
    row.getCell(3).value = value;
    row.getCell(3).alignment = { horizontal: "left" };
  });
}

/** Writes the legend and returns the first free row below it. */
function addLegend(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columnCount: number,
  checklist: boolean = false,
): number {
  const legend: [AttendanceMeetingCellStatus, string][] = checklist
    ? [
        ["present", "P = Present"],
        ["late", "L = Late"],
        ["excused", "I = Excused / approved absence"],
        ["sick", "S = Sick"],
        ["absent", "A = Absent"],
      ]
    : [
        ["present", "P = Present"],
        ["late", "L = Late"],
        ["excused", "I = Excused / approved absence"],
        ["sick", "S = Sick"],
        ["absent", "A = Absent"],
        ["not_recorded", "NR = Not recorded (not finalized)"],
        [
          "not_applicable",
          "— = Not applicable (joined later or meeting not opened)",
        ],
      ];

  const title = sheet.getRow(startRow);
  title.getCell(1).value = "Legend";
  title.getCell(1).font = { bold: true };
  sheet.mergeCells(startRow, 1, startRow, Math.min(columnCount, 6));

  legend.forEach(([status, label], index) => {
    const row = sheet.getRow(startRow + 1 + index);
    row.getCell(1).value = ATTENDANCE_MEETING_CELL_SYMBOLS[status];
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STATUS_FILLS[status] },
    };
    row.getCell(2).value = label;
    sheet.mergeCells(
      startRow + 1 + index,
      2,
      startRow + 1 + index,
      Math.min(columnCount, 6),
    );
  });

  return startRow + legend.length + 2;
}

function addAttendanceNote(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
  checklist: boolean = false,
): void {
  const row = sheet.getRow(rowNumber);
  row.getCell(1).value = checklist
    ? "Checklist entries are manual and are not written back to StarsTask. Use the app to correct official attendance."
    : "Attendance % = (present + late) / (present + late + absent + not recorded). Excused meetings are excluded. Unopened meetings are not counted.";
  sheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  row.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  row.getCell(1).alignment = { wrapText: true };
}

function styleHeaderRow(row: ExcelJS.Row, columnCount: number): void {
  row.height = 22;

  for (let column = 1; column <= columnCount; column += 1) {
    const cell = row.getCell(column);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = {
      vertical: "middle",
      wrapText: true,
      horizontal: column === 1 ? "center" : "left",
    };
    applyBorder(cell);
  }
}

function styleDataRow(row: ExcelJS.Row, columnCount: number): void {
  for (let column = 1; column <= columnCount; column += 1) {
    const cell = row.getCell(column);
    cell.alignment = {
      vertical: "middle",
      wrapText: true,
      horizontal: column === 1 ? "center" : "left",
    };
    applyBorder(cell);
  }
}

function applyBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER_COLOR } },
    left: { style: "thin", color: { argb: BORDER_COLOR } },
    bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    right: { style: "thin", color: { argb: BORDER_COLOR } },
  };
}

function landscapePageSetup(): Partial<ExcelJS.PageSetup> {
  return {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
}

function subjectLabel(subject: AttendanceExportSubject): string {
  return subject.code ? `${subject.name} (${subject.code})` : subject.name;
}

function subjectLecturer(context: AttendanceExportContext): string {
  return context.subject.lecturerName || context.classInfo.lecturer_name || "—";
}

function formatMeetingDate(
  meetingDate: string | null,
  startsAt: string,
): string {
  if (meetingDate) {
    const parsed = Date.parse(`${meetingDate}T00:00:00+07:00`);

    if (Number.isFinite(parsed)) {
      return dateFormatter.format(parsed);
    }
  }

  return dateFormatter.format(new Date(startsAt));
}

function formatDateTime(value: string): string {
  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? dateTimeFormatter.format(parsed) : "—";
}

function rosterNote(entry: AttendanceMeetingRosterEntry): string {
  if (!entry.eligible) {
    return "Joined after this meeting";
  }

  if (entry.note) {
    return entry.note;
  }

  if (entry.status === "absent" && entry.method === "system") {
    return "Finalized without a check-in";
  }

  if (entry.status === "not_recorded") {
    return "Not finalized";
  }

  return "";
}

async function workbookToBytes(
  workbook: ExcelJS.Workbook,
): Promise<Uint8Array> {
  const buffer = await workbook.xlsx.writeBuffer();

  return new Uint8Array(buffer as ArrayBuffer);
}
