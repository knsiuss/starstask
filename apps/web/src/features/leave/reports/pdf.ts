import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { LEAVE_REASON_LABELS, LEAVE_STATUS_LABELS } from "@starstask/contracts";
import {
  buildLeaveReportFilename,
  formatLeaveDate,
  formatLeaveDateRange,
  formatLeaveReportPeriod,
} from "@starstask/shared";

import type { LeaveReportRow } from "@/lib/db/leave";

/**
 * PDF report rendering.
 *
 * Two outputs share one layout: the Summary contains only the table, and the
 * Complete version appends the original evidence after it. The Summary is built
 * first and never depends on evidence, so a broken attachment cannot prevent a
 * usable report.
 *
 * Nothing here labels a request approved or rejected, and nothing claims the
 * lecturer received the package — the report says what the record says.
 */

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MARGIN = 44;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 28;

const INK = rgb(0.08, 0.09, 0.11);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.86, 0.88);

export type ReportClassInfo = {
  name: string;
  slug: string;
  courseName: string;
  semester: string;
  academicYear: string;
  lecturerName: string | null;
};

export type ReportInput = {
  classInfo: ReportClassInfo;
  from: string | null;
  to: string | null;
  rows: LeaveReportRow[];
  generatedAt: Date;
  /** Display name of whoever generated the report. */
  generatedBy: string;
};

export type MissingAttachment = {
  reference: string;
  filename: string;
  reason: string;
};

export type ReportBuild = {
  bytes: Uint8Array;
  missing: MissingAttachment[];
};

/**
 * Typographic punctuation folded to its ASCII equivalent.
 *
 * The standard fonts only cover WinAnsi, and the leave-range formatter emits an
 * en dash. Replacing it with "?" would print "12?14 Mar 2026", which reads as a
 * corrupted date, so the common typographic characters are transliterated
 * instead.
 */
const TYPOGRAPHIC_REPLACEMENTS: Record<string, string> = {
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u2022": "-",
  "\u2026": "...",
  "\u00a0": " ",
};

/**
 * Standard PDF fonts only cover WinAnsi, so a character outside it would throw
 * during `drawText`. Anything that cannot be transliterated becomes "?", which
 * keeps the report generatable for any name.
 */
function sanitize(value: string): string {
  let output = "";

  for (const char of value) {
    const replacement = TYPOGRAPHIC_REPLACEMENTS[char];

    if (replacement !== undefined) {
      output += replacement;
    } else if (char.charCodeAt(0) <= 0xff) {
      output += char;
    } else {
      output += "?";
    }
  }

  return output;
}

/** Greedy word wrap measured against the actual font metrics. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

type TableColumn = {
  header: string;
  width: number;
};

const COLUMNS: TableColumn[] = [
  { header: "Reference", width: 74 },
  { header: "Student", width: 96 },
  { header: "Absence dates", width: 104 },
  { header: "Reason", width: 72 },
  { header: "Submitted", width: 74 },
  { header: "Status", width: 87 },
];

type Cursor = {
  document: PDFDocument;
  page: ReturnType<PDFDocument["addPage"]>;
  y: number;
  pageNumber: number;
};

function startPage(
  document: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  context: { classInfo: ReportClassInfo; period: string },
): Cursor {
  const page = document.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;

  page.drawText("StarsTask", {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.bold,
    color: MUTED,
  });
  y -= 26;

  page.drawText("Absence request report", {
    x: MARGIN,
    y,
    size: 19,
    font: fonts.bold,
    color: INK,
  });
  y -= 22;

  const subtitle = `${sanitize(context.classInfo.name)} (${sanitize(context.classInfo.slug)})`;
  page.drawText(subtitle, {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.regular,
    color: INK,
  });
  y -= 15;

  page.drawText(
    `Period: ${sanitize(context.period)}   ·   Course: ${sanitize(context.classInfo.courseName)}   ·   ${sanitize(context.classInfo.semester)} ${sanitize(context.classInfo.academicYear)}`,
    { x: MARGIN, y, size: 8.5, font: fonts.regular, color: MUTED },
  );
  y -= 12;

  if (context.classInfo.lecturerName) {
    page.drawText(
      `Lecturer of record: ${sanitize(context.classInfo.lecturerName)}`,
      {
        x: MARGIN,
        y,
        size: 8.5,
        font: fonts.regular,
        color: MUTED,
      },
    );
    y -= 12;
  }

  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: RULE,
  });

  return { document, page, y: y - 16, pageNumber: 1 };
}

function drawFooter(
  page: Cursor["page"],
  pageNumber: number,
  generatedAt: Date,
  font: PDFFont,
) {
  const stamp = `Generated ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`;

  page.drawLine({
    start: { x: MARGIN, y: FOOTER_HEIGHT + 6 },
    end: { x: A4_WIDTH - MARGIN, y: FOOTER_HEIGHT + 6 },
    thickness: 0.5,
    color: RULE,
  });
  page.drawText(`Page ${pageNumber}   ·   ${stamp}`, {
    x: MARGIN,
    y: FOOTER_HEIGHT - 2,
    size: 7.5,
    font,
    color: MUTED,
  });
}

function drawTableHeader(
  cursor: Cursor,
  fonts: { regular: PDFFont; bold: PDFFont },
): Cursor {
  let x = MARGIN;

  for (const column of COLUMNS) {
    cursor.page.drawText(column.header, {
      x,
      y: cursor.y,
      size: 8,
      font: fonts.bold,
      color: MUTED,
    });
    x += column.width;
  }

  cursor.y -= 6;
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: A4_WIDTH - MARGIN, y: cursor.y },
    thickness: 0.6,
    color: RULE,
  });

  return { ...cursor, y: cursor.y - 13 };
}

function drawRow(
  cursor: Cursor,
  fonts: { regular: PDFFont; bold: PDFFont },
  row: LeaveReportRow,
): Cursor {
  const cells = [
    row.reference,
    row.studentName,
    formatLeaveDateRange(row.leaveStartDate, row.leaveEndDate),
    LEAVE_REASON_LABELS[row.reasonCategory],
    row.submittedAt ? formatLeaveDate(row.submittedAt.slice(0, 10)) : "—",
    LEAVE_STATUS_LABELS[row.status],
  ];

  const wrapped = cells.map((cell, index) =>
    wrapText(cell, fonts.regular, 8.5, (COLUMNS[index]?.width ?? 60) - 6),
  );
  const height = Math.max(...wrapped.map((lines) => lines.length)) * 11;

  let x = MARGIN;

  for (const [index, lines] of wrapped.entries()) {
    lines.forEach((line, lineIndex) => {
      cursor.page.drawText(line, {
        x,
        y: cursor.y - lineIndex * 11,
        size: 8.5,
        font: fonts.regular,
        color: INK,
      });
    });

    x += COLUMNS[index]?.width ?? 60;
  }

  return { ...cursor, y: cursor.y - height - 4 };
}

/** Summary counts, computed from the rows themselves. */
function summarise(rows: LeaveReportRow[]): string {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = LEAVE_STATUS_LABELS[row.status];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const order = ["Submitted", "Forwarded", "Cancelled"];
  const parts = order
    .filter((label) => (counts.get(label) ?? 0) > 0)
    .map((label) => `${label}: ${counts.get(label)}`);

  return parts.length > 0
    ? parts.join("   ·   ")
    : "No requests in this period";
}

async function renderTable(
  document: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: ReportInput,
): Promise<PDFDocument> {
  const period = formatLeaveReportPeriod(input.from, input.to);
  let cursor = startPage(document, fonts, {
    classInfo: input.classInfo,
    period,
  });

  cursor.page.drawText(summarise(input.rows), {
    x: MARGIN,
    y: cursor.y,
    size: 9,
    font: fonts.bold,
    color: INK,
  });
  cursor.y -= 10;

  cursor.page.drawText(
    `Generated by ${sanitize(input.generatedBy)} · ${input.rows.length} request${input.rows.length === 1 ? "" : "s"}`,
    { x: MARGIN, y: cursor.y, size: 8, font: fonts.regular, color: MUTED },
  );
  cursor.y -= 18;

  cursor = drawTableHeader(cursor, fonts);

  for (const row of input.rows) {
    // Break before the row would collide with the footer, then repeat the header.
    if (cursor.y < FOOTER_HEIGHT + 40) {
      drawFooter(
        cursor.page,
        cursor.pageNumber,
        input.generatedAt,
        fonts.regular,
      );
      const next = document.addPage([A4_WIDTH, A4_HEIGHT]);
      cursor = {
        document,
        page: next,
        y: A4_HEIGHT - MARGIN,
        pageNumber: cursor.pageNumber + 1,
      };
      cursor = drawTableHeader(cursor, fonts);
    }

    cursor = drawRow(cursor, fonts, row);
  }

  if (input.rows.length === 0) {
    cursor.page.drawText("No requests matched this period.", {
      x: MARGIN,
      y: cursor.y,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });
    cursor.y -= 14;
  }

  cursor.y -= 8;
  cursor.page.drawText(
    "This report lists absence requests collected by StarsTask. It is not an approval record: forwarding a request does not mean the lecturer approved it.",
    {
      x: MARGIN,
      y: cursor.y,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
      maxWidth: CONTENT_WIDTH,
      lineHeight: 10,
    },
  );

  drawFooter(cursor.page, cursor.pageNumber, input.generatedAt, fonts.regular);

  return document;
}

/** Summary PDF: the table only, independent of any evidence file. */
export async function buildSummaryPdf(input: ReportInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };

  await renderTable(document, fonts, input);

  document.setTitle("StarsTask absence request report");
  document.setProducer("StarsTask");
  document.setCreator("StarsTask");

  return document.save();
}

export type EvidenceSource = {
  requestId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
};

export type CompletePdfOptions = {
  /** Loads raw bytes for one evidence object. Returns null when unreadable. */
  load: (storagePath: string) => Promise<Uint8Array | null>;
};

/**
 * Complete PDF: the table followed by the original evidence.
 *
 * Attachments are appended after the table rather than interleaved, so the
 * report reads as a document and each attachment is labelled with the reference
 * that ties it back to a table row.
 */
export async function buildCompletePdf(
  input: ReportInput,
  evidenceByRequest: Map<string, EvidenceSource[]>,
  options: CompletePdfOptions,
): Promise<ReportBuild> {
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };

  await renderTable(document, fonts, input);

  const missing: MissingAttachment[] = [];
  const period = formatLeaveReportPeriod(input.from, input.to);

  // Attachments are driven by the table rows, so evidence for a request that is
  // not in this report can never be appended by accident.
  let hasAttachments = false;

  for (const row of input.rows) {
    const evidence = evidenceByRequest.get(row.id) ?? [];

    if (evidence.length === 0) {
      continue;
    }

    for (const item of evidence) {
      const bytes = await options.load(item.storagePath);

      if (!bytes) {
        missing.push({
          reference: row.reference,
          filename: item.originalFilename,
          reason: "The file could not be downloaded.",
        });
        continue;
      }

      try {
        if (item.mimeType === "application/pdf") {
          const source = await PDFDocument.load(bytes, {
            ignoreEncryption: true,
          });
          const copied = await document.copyPages(
            source,
            source.getPageIndices(),
          );

          for (const page of copied) {
            document.addPage(page);
          }

          hasAttachments = true;
        } else {
          const image =
            item.mimeType === "image/png"
              ? await document.embedPng(bytes)
              : await document.embedJpg(bytes);

          const page = document.addPage([A4_WIDTH, A4_HEIGHT]);
          const label = `${row.reference} · ${sanitize(row.studentName)} · ${sanitize(item.originalFilename)}`;

          page.drawText(label, {
            x: MARGIN,
            y: A4_HEIGHT - MARGIN,
            size: 8.5,
            font: fonts.regular,
            color: MUTED,
            maxWidth: CONTENT_WIDTH,
          });

          // Fit inside the printable area without ever cropping: scale by the
          // tighter of the two ratios and centre what is left over.
          const maxWidth = CONTENT_WIDTH;
          const maxHeight = A4_HEIGHT - MARGIN * 2 - 24;
          const scale = Math.min(
            maxWidth / image.width,
            maxHeight / image.height,
            1,
          );
          const width = image.width * scale;
          const height = image.height * scale;

          page.drawImage(image, {
            x: MARGIN + (maxWidth - width) / 2,
            y: MARGIN + (maxHeight - height) / 2,
            width,
            height,
          });

          hasAttachments = true;
        }
      } catch {
        missing.push({
          reference: row.reference,
          filename: item.originalFilename,
          reason: "The file could not be added to the PDF.",
        });
      }
    }
  }

  if (!hasAttachments) {
    const page = document.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawText("No evidence could be attached to this report.", {
      x: MARGIN,
      y: A4_HEIGHT - MARGIN,
      size: 10,
      font: fonts.bold,
      color: INK,
    });
    page.drawText(
      `Period: ${sanitize(period)}. The summary table above is complete; attachments were unavailable.`,
      {
        x: MARGIN,
        y: A4_HEIGHT - MARGIN - 18,
        size: 8.5,
        font: fonts.regular,
        color: MUTED,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 11,
      },
    );
  }

  if (missing.length > 0) {
    const page = document.addPage([A4_WIDTH, A4_HEIGHT]);
    let y = A4_HEIGHT - MARGIN;

    page.drawText("Attachments not included", {
      x: MARGIN,
      y,
      size: 12,
      font: fonts.bold,
      color: INK,
    });
    y -= 18;

    page.drawText(
      "These files belong to requests in this report but could not be included. The report is therefore not a complete evidence package.",
      {
        x: MARGIN,
        y,
        size: 8.5,
        font: fonts.regular,
        color: MUTED,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 11,
      },
    );
    y -= 26;

    for (const item of missing) {
      const lines = wrapText(
        `${item.reference} · ${item.filename} — ${item.reason}`,
        fonts.regular,
        8.5,
        CONTENT_WIDTH,
      );

      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 8.5,
          font: fonts.regular,
          color: INK,
        });
        y -= 11;
      }

      y -= 3;
    }
  }

  document.setTitle("StarsTask absence request report (complete)");
  document.setProducer("StarsTask");
  document.setCreator("StarsTask");

  return { bytes: await document.save(), missing };
}

export function reportFilename(
  classSlug: string,
  format: "summary" | "complete",
  from: string | null,
  to: string | null,
): string {
  return buildLeaveReportFilename({ classSlug, format, from, to });
}
