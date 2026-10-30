import { readFile } from "node:fs/promises";

import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import {
  buildCompletePdf,
  buildSummaryPdf,
  reportFilename,
  type EvidenceSource,
  type ReportInput,
} from "@/features/leave/reports/pdf";
import type { LeaveReportRow } from "@/lib/db/leave";

/**
 * Report integrity.
 *
 * The contract these tests pin: every row reaches the table, every attachment is
 * traceable back to a row by its reference, and an attachment that cannot be
 * included is reported rather than silently dropped.
 */

const CLASS_INFO = {
  name: "Algoritma dan Struktur Data",
  slug: "cs101",
  courseName: "CS101",
  semester: "Ganjil",
  academicYear: "2025/2026",
  lecturerName: "Dr. Tan",
};

const ROWS: LeaveReportRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "LR-AAAA11112222",
    studentName: "Budi Santoso",
    leaveStartDate: "2026-03-12",
    leaveEndDate: "2026-03-14",
    documentIssueDate: "2026-03-10",
    reasonCategory: "illness",
    submittedAt: "2026-03-11T04:05:06.000Z",
    status: "submitted",
    cancellationNote: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    reference: "LR-BBBB33334444",
    studentName: "Alice Tan",
    leaveStartDate: "2026-04-01",
    leaveEndDate: "2026-04-01",
    documentIssueDate: null,
    reasonCategory: "family_matter",
    submittedAt: "2026-03-30T01:02:03.000Z",
    status: "forwarded",
    cancellationNote: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    reference: "LR-CCCC55556666",
    studentName: "Citra Dewi",
    leaveStartDate: "2026-04-10",
    leaveEndDate: "2026-04-11",
    documentIssueDate: null,
    reasonCategory: "other",
    submittedAt: "2026-04-05T02:03:04.000Z",
    status: "cancelled",
    cancellationNote: "No longer needed",
  },
];

function reportInput(rows: LeaveReportRow[]): ReportInput {
  return {
    classInfo: CLASS_INFO,
    from: "2026-03-01",
    to: "2026-04-30",
    rows,
    generatedAt: new Date("2026-05-01T09:00:00.000Z"),
    generatedBy: "Siti Admin",
  };
}

async function textOf(bytes: Uint8Array): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(document, { mergePages: true });

  return Array.isArray(text) ? text.join("\n") : text;
}

async function pageCountOf(bytes: Uint8Array): Promise<number> {
  const document = await PDFDocument.load(bytes);

  return document.getPageCount();
}

async function pngBytes(): Promise<Uint8Array> {
  const bytes = await readFile(
    new URL("../../public/icons/icon-192.png", import.meta.url),
  );

  return new Uint8Array(bytes);
}

describe("buildSummaryPdf", () => {
  it("puts every request in the table", async () => {
    const text = await textOf(await buildSummaryPdf(reportInput(ROWS)));

    for (const row of ROWS) {
      expect(text).toContain(row.reference);
      expect(text).toContain(row.studentName);
    }
  });

  it("keeps the three dates distinct", async () => {
    const text = await textOf(await buildSummaryPdf(reportInput(ROWS)));

    // Leave period, issue date and submission date all appear as their own
    // values rather than one being derived from another. The range separator is
    // folded to ASCII because the PDF fonts cannot carry an en dash.
    expect(text).toContain("12-14 Mar 2026");
    expect(text).toContain("1 Apr 2026");
    expect(text).toContain("11 Mar 2026");
  });

  it("never presents forwarding as an approval", async () => {
    const text = await textOf(await buildSummaryPdf(reportInput(ROWS)));

    expect(text).toContain("Forwarded");
    expect(text).toContain("not an approval record");
    expect(text).not.toContain("Rejected");
    expect(text).not.toContain("Approved");
  });

  it("lists a cancelled request without adding a decision column", async () => {
    const text = await textOf(await buildSummaryPdf(reportInput(ROWS)));

    expect(text).toContain("LR-CCCC55556666");
    expect(text).toContain("Citra Dewi");
    expect(text).toContain("Cancelled");
    expect(text).toContain("Cancelled: 1");
  });

  it("still produces a usable report with no rows", async () => {
    const bytes = await buildSummaryPdf(reportInput([]));
    const text = await textOf(bytes);

    expect(text).toContain("No requests matched this period.");
    expect(await pageCountOf(bytes)).toBeGreaterThanOrEqual(1);
  });

  it("works without any evidence at all", async () => {
    // The summary never touches storage, so a broken bucket cannot block it.
    const bytes = await buildSummaryPdf(reportInput(ROWS));

    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});

describe("buildCompletePdf", () => {
  const evidence: EvidenceSource = {
    requestId: ROWS[0]?.id ?? "",
    storagePath: "student/request/file.png",
    originalFilename: "surat-dokter.png",
    mimeType: "image/png",
  };

  function mapWith(items: EvidenceSource[]): Map<string, EvidenceSource[]> {
    const grouped = new Map<string, EvidenceSource[]>();

    for (const item of items) {
      const list = grouped.get(item.requestId) ?? [];
      list.push(item);
      grouped.set(item.requestId, list);
    }

    return grouped;
  }

  it("appends the image and labels it with the request reference", async () => {
    const png = await pngBytes();
    const built = await buildCompletePdf(
      reportInput(ROWS),
      mapWith([evidence]),
      { load: async () => png },
    );

    expect(built.missing).toEqual([]);

    const text = await textOf(built.bytes);

    // The attachment is traceable back to its row.
    expect(text).toContain("LR-AAAA11112222");
    expect(text).toContain("surat-dokter.png");
    expect(text).toContain("Budi Santoso");
  });

  it("adds a page per attachment on top of the table", async () => {
    const png = await pngBytes();
    const summaryPages = await pageCountOf(
      await buildSummaryPdf(reportInput(ROWS)),
    );
    const completePages = await pageCountOf(
      (
        await buildCompletePdf(reportInput(ROWS), mapWith([evidence]), {
          load: async () => png,
        })
      ).bytes,
    );

    expect(completePages).toBe(summaryPages + 1);
  });

  it("reports a file it could not load instead of dropping it", async () => {
    const built = await buildCompletePdf(
      reportInput(ROWS),
      mapWith([evidence]),
      { load: async () => null },
    );

    expect(built.missing).toHaveLength(1);
    expect(built.missing[0]?.reference).toBe("LR-AAAA11112222");
    expect(built.missing[0]?.filename).toBe("surat-dokter.png");

    const text = await textOf(built.bytes);

    // The table survives, and the gap is stated in the document itself.
    expect(text).toContain("LR-AAAA11112222");
    expect(text).toContain("Attachments not included");
    expect(text).toContain("surat-dokter.png");
  });

  it("says so when nothing could be attached", async () => {
    const built = await buildCompletePdf(reportInput(ROWS), new Map(), {
      load: async () => null,
    });

    const text = await textOf(built.bytes);

    expect(text).toContain("No evidence could be attached to this report.");
    expect(built.missing).toEqual([]);
  });

  it("never attaches evidence for a request outside the report", async () => {
    const stray: EvidenceSource = {
      ...evidence,
      requestId: "99999999-9999-4999-8999-999999999999",
      originalFilename: "not-in-report.png",
    };
    const png = await pngBytes();

    const built = await buildCompletePdf(reportInput(ROWS), mapWith([stray]), {
      load: async () => png,
    });

    const text = await textOf(built.bytes);

    expect(text).not.toContain("not-in-report.png");
    expect(text).toContain("No evidence could be attached to this report.");
  });
});

describe("reportFilename", () => {
  it("builds a filename from validated segments", () => {
    expect(reportFilename("cs101", "summary", "2026-03-01", "2026-04-30")).toBe(
      "starstask-absence-cs101-2026-03-01-2026-04-30-summary.pdf",
    );
  });

  it("falls back when the period is open-ended", () => {
    expect(reportFilename("cs101", "complete", null, null)).toBe(
      "starstask-absence-cs101-start-today-complete.pdf",
    );
  });

  it("cannot be steered with a hostile slug", () => {
    const name = reportFilename("../../etc", "summary", null, null);

    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });
});
