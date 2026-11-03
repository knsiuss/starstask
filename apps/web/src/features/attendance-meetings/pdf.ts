import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { ATTENDANCE_MEETING_CELL_LABELS } from "@starstask/contracts";

import type {
  AttendanceCorrectionAuditEntry,
  AttendanceRecap,
} from "@/lib/attendance/meeting-types";
import type { AttendanceExportContext } from "@/features/attendance-meetings/excel";

const A4_WIDTH = 842; // landscape
const A4_HEIGHT = 595;
const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 16;
const FOOTER_HEIGHT = 24;

const INK = rgb(0.08, 0.09, 0.11);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.86, 0.88);

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
  timeZoneName: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

function fmtDateTime(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? dateTimeFormatter.format(parsed) : "—";
}

function fmtDate(value: string | null, fallback: string): string {
  if (value) {
    const parsed = Date.parse(`${value}T00:00:00+07:00`);
    if (Number.isFinite(parsed)) return dateFormatter.format(parsed);
  }
  return dateFormatter.format(new Date(fallback));
}

type Ctx = {
  doc: PDFDocument;
  page: import("pdf-lib").PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  pageNumber: number;
};

function newPage(ctx: Ctx): void {
  ctx.pageNumber += 1;
  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.y = A4_HEIGHT - MARGIN;
  drawFooter(ctx);
}

function drawFooter(ctx: Ctx): void {
  ctx.font && ctx.page.drawText("StarsTask", {
    x: MARGIN,
    y: FOOTER_HEIGHT - 6,
    size: 8,
    font: ctx.font,
    color: MUTED,
  });
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y < MARGIN + needed + FOOTER_HEIGHT) {
    newPage(ctx);
  }
}

function text(ctx: Ctx, value: string, size: number, opts?: { bold?: boolean; muted?: boolean; y?: number }): void {
  ctx.page.drawText(value.replace(/[^\x20-\x7E]/g, "?"), {
    x: MARGIN,
    y: opts?.y ?? ctx.y,
    size,
    font: opts?.bold ? ctx.fontBold : ctx.font,
    color: opts?.muted ? MUTED : INK,
  });
}

function line(ctx: Ctx): void {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: ctx.y },
    thickness: 0.7,
    color: RULE,
  });
  ctx.y -= 6;
}

function kv(ctx: Ctx, label: string, value: string): void {
  ensureSpace(ctx, ROW_HEIGHT + 4);
  text(ctx, label, 9, { muted: true, bold: true });
  ctx.page.drawText(value.replace(/[^\x20-\x7E]/g, "?"), {
    x: MARGIN + 160,
    y: ctx.y,
    size: 9,
    font: ctx.font,
    color: INK,
  });
  ctx.y -= 13;
}

/**
 * Formal PDF attendance report built from structured recap data.
 * Landscape A4, repeatable table headers, multi-page safe. No GPS data.
 */
export async function buildAttendanceReportPdf(
  recap: AttendanceRecap,
  context: AttendanceExportContext,
  audits: AttendanceCorrectionAuditEntry[] = [],
  preparedBy: string | null = null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = {
    doc,
    page: null as unknown as import("pdf-lib").PDFPage,
    font,
    fontBold,
    y: 0,
    pageNumber: 0,
  };
  newPage(ctx);

  // Header
  text(ctx, "StarsTask — Attendance Report", 18, { bold: true });
  ctx.y -= 22;
  text(ctx, `Generated ${fmtDateTime(context.generatedAt.toISOString())}`, 9, { muted: true });
  ctx.y -= 8;
  line(ctx);

  // Academic info
  kv(ctx, "Class", context.classInfo.name);
  kv(ctx, "Class code", context.classInfo.class_code ?? "—");
  kv(ctx, `Subject`, context.subject.code ? `${context.subject.name} (${context.subject.code})` : context.subject.name);
  kv(ctx, "Lecturer", context.subject.lecturerName ?? context.classInfo.lecturer_name ?? "—");
  kv(ctx, "Semester", context.subject.semester);
  kv(ctx, "Academic year", context.subject.academicYear);
  if (preparedBy) kv(ctx, "Prepared by", preparedBy);
  ctx.y -= 6;

  // Summary totals
  const present = recap.students.reduce((s, st) => s + st.totals.present, 0);
  const late = recap.students.reduce((s, st) => s + st.totals.late, 0);
  const excused = recap.students.reduce((s, st) => s + st.totals.excused, 0);
  const absent = recap.students.reduce((s, st) => s + st.totals.absent, 0);
  const attended = present + late + excused;
  const eligible = recap.students.reduce((s, st) => s + st.totals.eligible, 0);
  const pct = eligible > 0 ? ((attended / eligible) * 100).toFixed(1) : "0.0";

  text(ctx, "Attendance Overview", 12, { bold: true });
  ctx.y -= 16;
  kv(ctx, "Total students", String(recap.students.length));
  kv(ctx, "Total meetings", String(recap.meetings.length));
  kv(ctx, "Present", String(present));
  kv(ctx, "Late", String(late));
  kv(ctx, "Excused", String(excused));
  kv(ctx, "Absent", String(absent));
  kv(ctx, "Attendance %", `${pct}%`);
  ctx.y -= 8;

  // Student summary table
  text(ctx, "Student Attendance Summary", 12, { bold: true });
  ctx.y -= 16;
  line(ctx);

  const headers = ["No.", "Student ID", "Student name", "P", "L", "E", "A", "%"];
  const colX = [MARGIN, MARGIN + 40, MARGIN + 140, MARGIN + 380, MARGIN + 420, MARGIN + 460, MARGIN + 500, MARGIN + 540];
  const drawHeader = (): void => {
    ensureSpace(ctx, ROW_HEIGHT * 2);
    headers.forEach((h, i) => {
      ctx.page.drawText(h, { x: colX[i] ?? MARGIN, y: ctx.y, size: 8, font: ctx.fontBold, color: INK });
    });
    ctx.y -= ROW_HEIGHT;
  };
  drawHeader();

  recap.students.forEach((student, index) => {
    if (ctx.y < MARGIN + FOOTER_HEIGHT + ROW_HEIGHT) {
      newPage(ctx);
      drawHeader();
    }
    const p = String(student.totals.present);
    const l = String(student.totals.late);
    const e = String(student.totals.excused);
    const a = String(student.totals.absent);
    const perc = student.totals.percentage === null ? "—" : String(student.totals.percentage);
    const row = [String(index + 1), student.nim ?? "—", student.fullName, p, l, e, a, perc];
    row.forEach((cell, i) => {
      ctx.page.drawText(cell.replace(/[^\x20-\x7E]/g, "?"), {
        x: colX[i] ?? MARGIN,
        y: ctx.y,
        size: 8,
        font: ctx.font,
        color: INK,
      });
    });
    ctx.y -= ROW_HEIGHT;
  });

  if (recap.students.length === 0) {
    text(ctx, "No registered students in this class yet.", 9, { muted: true });
    ctx.y -= 13;
  }

  // Meeting details
  ctx.y -= 10;
  text(ctx, "Meeting Details", 12, { bold: true });
  ctx.y -= 16;
  line(ctx);

  const mHeaders = ["#", "Date", "Meeting", "P", "L", "E", "A", "%"];
  const mX = [MARGIN, MARGIN + 40, MARGIN + 140, MARGIN + 380, MARGIN + 420, MARGIN + 460, MARGIN + 500, MARGIN + 540];
  const drawMHeader = (): void => {
    ensureSpace(ctx, ROW_HEIGHT * 2);
    mHeaders.forEach((h, i) => {
      ctx.page.drawText(h, { x: mX[i] ?? MARGIN, y: ctx.y, size: 8, font: ctx.fontBold, color: INK });
    });
    ctx.y -= ROW_HEIGHT;
  };
  drawMHeader();

  for (const [mi, meeting] of recap.meetings.entries()) {
    if (ctx.y < MARGIN + FOOTER_HEIGHT + ROW_HEIGHT) {
      newPage(ctx);
      drawMHeader();
    }
    let mp = 0, ml = 0, me = 0, ma = 0, elig = 0;
    for (const student of recap.students) {
      const cell = student.cells[meeting.sessionId] ?? "not_applicable";
      if (cell === "not_applicable") continue;
      elig += 1;
      if (cell === "present") mp += 1;
      else if (cell === "late") ml += 1;
      else if (cell === "excused") me += 1;
      else if (cell === "absent") ma += 1;
    }
    const attendedM = mp + ml + me;
    const pctM = elig > 0 ? ((attendedM / elig) * 100).toFixed(1) : "0.0";
    const row = [
      String(mi + 1),
      fmtDate(meeting.meetingDate, meeting.startsAt),
      `${meeting.title}`.slice(0, 60),
      String(mp),
      String(ml),
      String(me),
      String(ma),
      pctM,
    ];
    row.forEach((cell, i) => {
      ctx.page.drawText(cell.replace(/[^\x20-\x7E]/g, "?"), {
        x: mX[i] ?? MARGIN,
        y: ctx.y,
        size: 8,
        font: ctx.font,
        color: INK,
      });
    });
    ctx.y -= ROW_HEIGHT;
  }

  if (recap.meetings.length === 0) {
    text(ctx, "No meetings in this scope yet.", 9, { muted: true });
    ctx.y -= 13;
  }

  // Correction notes
  if (audits.length > 0) {
    ctx.y -= 10;
    text(ctx, "Correction Notes", 12, { bold: true });
    ctx.y -= 16;
    line(ctx);
    for (const entry of audits) {
      ensureSpace(ctx, ROW_HEIGHT * 2);
      const label = `${entry.studentName}${entry.studentNim ? ` (${entry.studentNim})` : ""} — ${entry.previousStatus} → ${entry.newStatus} by ${entry.adminName}`;
      text(ctx, label.slice(0, 110), 8);
      ctx.y -= ROW_HEIGHT;
      text(ctx, `${entry.reason}${entry.physicallyVerified ? " [physically verified]" : ""}`.slice(0, 130), 8, { muted: true });
      ctx.y -= ROW_HEIGHT;
    }
  }

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

export function attendanceStatusLabel(status: string): string {
  return ATTENDANCE_MEETING_CELL_LABELS[status as keyof typeof ATTENDANCE_MEETING_CELL_LABELS] ?? status;
}
