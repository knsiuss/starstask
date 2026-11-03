import "server-only";

import ExcelJS from "exceljs";

import {
  ATTENDANCE_MEETING_CELL_LABELS,
  ATTENDANCE_MEETING_CELL_SYMBOLS,
  type AttendanceMeetingCellStatus,
} from "@starstask/contracts";

import type {
  AttendanceCorrectionAuditEntry,
  AttendanceMeetingDetail,
  AttendanceMeetingRosterEntry,
  AttendanceRecap,
} from "@/lib/attendance/meeting-types";
import type { ClassSummary } from "@/lib/db/classes";

const TIME_ZONE = "Asia/Jakarta";
const HEADER_FILL = "FF0F172A";
const BORDER_COLOR = "FFCBD5E1";
const MUTED_TEXT = "FF64748B";

const STATUS_FILLS: Record<AttendanceMeetingCellStatus, string> = {
  present: "FFDCFCE7",
  late: "FFFEF3C7",
  excused: "FFDBEAFE",
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

/** Semester recap matrix with one column per meeting. */
export async function buildRecapWorkbook(
  recap: AttendanceRecap,
  context: AttendanceExportContext,
  audits: AttendanceCorrectionAuditEntry[] = [],
): Promise<Uint8Array> {
  const workbook = createWorkbook(context.generatedAt);
  const sheet = workbook.addWorksheet("Summary", {
    pageSetup: landscapePageSetup(),
  });

  sheet.columns = [
    { key: "no", width: 7 },
    { key: "nim", width: 20 },
    { key: "name", width: 32 },
    ...recap.meetings.map(() => ({ width: 11 })),
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 7 },
    { width: 14 },
  ];

  let row = addReportHeading(
    sheet,
    "Semester Attendance Recap",
    subjectLabel(context.subject),
  );

  row = addMetadataRows(sheet, row, 3 + recap.meetings.length + 6, [
    ["Class", context.classInfo.name],
    ["Class code", context.classInfo.class_code ?? "—"],
    ["Subject", subjectLabel(context.subject)],
    ["Lecturer", subjectLecturer(context)],
    ["Semester", context.subject.semester],
    ["Academic year", context.subject.academicYear],
    ["Meetings", String(recap.meetings.length)],
    ["Exported at", formatDateTime(context.generatedAt.toISOString())],
  ]);

  const headerRowNumber = row;
  const headerRow = sheet.getRow(headerRowNumber);
  const headerValues: (string | number)[] = [
    "No.",
    "NIM",
    "Student name",
    ...recap.meetings.map((meeting) => `Pertemuan ${meeting.meetingNumber}`),
    "P",
    "L",
    "I",
    "A",
    "NR",
    "Attendance %",
  ];
  headerRow.values = headerValues;
  styleHeaderRow(headerRow, headerValues.length);

  const firstDataRow = headerRowNumber + 1;

  recap.students.forEach((student, index) => {
    const dataRow = sheet.getRow(firstDataRow + index);
    const values: (string | number | null)[] = [
      index + 1,
      student.nim ?? "—",
      student.fullName,
      ...recap.meetings.map(
        (meeting) =>
          ATTENDANCE_MEETING_CELL_SYMBOLS[
            student.cells[meeting.sessionId] ?? "not_applicable"
          ],
      ),
      student.totals.present,
      student.totals.late,
      student.totals.excused,
      student.totals.absent,
      student.totals.notRecorded,
      student.totals.percentage === null ? "—" : student.totals.percentage,
    ];
    dataRow.values = values;
    styleDataRow(dataRow, values.length);

    recap.meetings.forEach((meeting, meetingIndex) => {
      const status = student.cells[meeting.sessionId] ?? "not_applicable";
      const cell = dataRow.getCell(4 + meetingIndex);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STATUS_FILLS[status] },
      };
      cell.font = { bold: status === "present" };
    });

    for (
      let column = 4 + recap.meetings.length;
      column < values.length;
      column += 1
    ) {
      dataRow.getCell(column).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    }

    const percentageCell = dataRow.getCell(values.length);
    percentageCell.alignment = { horizontal: "right", vertical: "middle" };
    percentageCell.numFmt = '0.0"%"';
  });

  const lastDataRow = firstDataRow + recap.students.length - 1;

  if (recap.students.length === 0) {
    const emptyRow = sheet.getRow(firstDataRow);
    emptyRow.getCell(1).value = "No registered students in this class yet.";
    sheet.mergeCells(firstDataRow, 1, firstDataRow, headerValues.length);
    emptyRow.getCell(1).font = { italic: true, color: { argb: MUTED_TEXT } };
  }

  const legendRow = Math.max(lastDataRow, firstDataRow) + 2;
  const noteRow = addLegend(sheet, legendRow, headerValues.length);
  addAttendanceNote(sheet, noteRow, headerValues.length);

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: {
      row: Math.max(lastDataRow, firstDataRow),
      column: headerValues.length,
    },
  };
  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

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
          formulae: ['"P,L,I,A"'],
          showErrorMessage: true,
          errorTitle: "Use a checklist code",
          error: "Choose P, L, I, or A.",
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
    row.getCell(2).value = value;
    sheet.mergeCells(startRow + index, 2, startRow + index, columnCount);
  });

  return startRow + rows.length + 1;
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
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: "left" };
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
        ["absent", "A = Absent"],
      ]
    : [
        ["present", "P = Present"],
        ["late", "L = Late"],
        ["excused", "I = Excused / approved absence"],
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
