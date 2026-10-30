import { describe, expect, it } from "vitest";

import {
  detectDocumentType,
  findDates,
  parseOcrText,
  toIsoDate,
} from "@/lib/ocr/parse";

/**
 * The parser only proposes values; it never decides anything. These tests pin
 * the two things that matter: it reads a labelled document correctly, and it
 * stays silent rather than guessing.
 */

describe("toIsoDate", () => {
  it("builds a real calendar date", () => {
    expect(toIsoDate(2026, 3, 12)).toBe("2026-03-12");
    expect(toIsoDate(2026, 1, 1)).toBe("2026-01-01");
  });

  it("rejects an impossible day", () => {
    // 30 February would otherwise roll forward into March.
    expect(toIsoDate(2026, 2, 30)).toBeNull();
    expect(toIsoDate(2026, 4, 31)).toBeNull();
  });

  it("rejects out-of-range months and years", () => {
    expect(toIsoDate(2026, 13, 1)).toBeNull();
    expect(toIsoDate(1899, 1, 1)).toBeNull();
    expect(toIsoDate(3000, 1, 1)).toBeNull();
  });
});

describe("findDates", () => {
  it("finds ISO dates in document order", () => {
    const hits = findDates("From 2026-03-12 until 2026-03-14.");

    expect(hits.map((hit) => hit.iso)).toEqual(["2026-03-12", "2026-03-14"]);
  });

  it("reads day-first numeric dates", () => {
    const hits = findDates("Tanggal: 12/03/2026");

    expect(hits.map((hit) => hit.iso)).toEqual(["2026-03-12"]);
  });

  it("swaps an unambiguous month-first numeric date", () => {
    // 25 cannot be a month, so this can only be M/D/Y.
    const hits = findDates("Date: 03/25/2026");

    expect(hits.map((hit) => hit.iso)).toEqual(["2026-03-25"]);
  });

  it("reads Indonesian and English month names", () => {
    expect(findDates("10 Maret 2026").map((hit) => hit.iso)).toEqual([
      "2026-03-10",
    ]);
    expect(findDates("10 March 2026").map((hit) => hit.iso)).toEqual([
      "2026-03-10",
    ]);
  });

  it("ignores text with no dates", () => {
    expect(findDates("Surat keterangan tanpa tanggal")).toEqual([]);
  });
});

describe("detectDocumentType", () => {
  it("recognises a medical certificate", () => {
    expect(detectDocumentType("SURAT KETERANGAN SAKIT")).toBe(
      "Medical certificate",
    );
    expect(detectDocumentType("Medical Certificate")).toBe(
      "Medical certificate",
    );
  });

  it("recognises hospital and permit documents", () => {
    expect(detectDocumentType("Surat rawat inap")).toBe("Hospital document");
    expect(detectDocumentType("Surat izin tidak masuk")).toBe("Leave permit");
  });

  it("returns null when the text says nothing about a type", () => {
    expect(detectDocumentType("Catatan biasa")).toBeNull();
  });
});

describe("parseOcrText", () => {
  it("reads a labelled Indonesian medical certificate", () => {
    const suggestion = parseOcrText(
      [
        "SURAT KETERANGAN SAKIT",
        "Tanggal Surat: 10 Maret 2026",
        "Nama: Budi Santoso",
        "Diberikan izin tanggal 12 Maret 2026 s.d. 14 Maret 2026",
      ].join("\n"),
    );

    expect(suggestion.documentIssueDate).toBe("2026-03-10");
    expect(suggestion.leaveStartDate).toBe("2026-03-12");
    expect(suggestion.leaveEndDate).toBe("2026-03-14");
    expect(suggestion.studentName).toBe("Budi Santoso");
    expect(suggestion.documentType).toBe("Medical certificate");
  });

  it("keeps the issue date separate from the leave dates", () => {
    const suggestion = parseOcrText(
      [
        "Medical Certificate",
        "Issue date: 5 January 2026",
        "Name: Alice Tan",
        "Leave period: 12 January 2026 to 14 January 2026",
      ].join("\n"),
    );

    // The three dates answer different questions and must never be merged.
    expect(suggestion.documentIssueDate).toBe("2026-01-05");
    expect(suggestion.leaveStartDate).toBe("2026-01-12");
    expect(suggestion.leaveEndDate).toBe("2026-01-14");
    expect(suggestion.studentName).toBe("Alice Tan");
  });

  it("falls back to the first date as the issue date", () => {
    const suggestion = parseOcrText("Tanggal Surat : 10/03/2026");

    expect(suggestion.documentIssueDate).toBe("2026-03-10");
    expect(suggestion.leaveStartDate).toBeUndefined();
  });

  it("never invents a leave period from one unlabelled date", () => {
    const suggestion = parseOcrText("12 Maret 2026");

    expect(suggestion.leaveStartDate).toBeUndefined();
    expect(suggestion.leaveEndDate).toBeUndefined();
  });

  it("returns nothing for empty or unreadable text", () => {
    expect(parseOcrText("")).toEqual({});
    expect(parseOcrText("   \n\n  ")).toEqual({});
    expect(parseOcrText("lorem ipsum dolor sit amet")).toEqual({});
  });

  it("caps confidence below certainty", () => {
    // Reading a document is not proof that it is genuine, so no result is ever
    // reported as certain.
    const suggestion = parseOcrText(
      [
        "SURAT KETERANGAN SAKIT",
        "Tanggal Surat: 10 Maret 2026",
        "Nama: Budi Santoso",
        "izin tanggal 12 Maret 2026 s.d. 14 Maret 2026",
      ].join("\n"),
    );

    expect(suggestion.confidence).toBeDefined();
    expect(suggestion.confidence).toBeLessThanOrEqual(0.9);
  });

  it("rejects a name containing digits", () => {
    const suggestion = parseOcrText("Nama: Jalan 12 No 4");

    expect(suggestion.studentName).toBeUndefined();
  });
});
