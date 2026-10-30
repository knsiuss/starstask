import { describe, expect, it } from "vitest";

import {
  CSV_BOM,
  escapeCsvCell,
  escapeCsvFormula,
  toCsv,
  withBom,
} from "@starstask/shared";

describe("escapeCsvFormula", () => {
  it("neutralises every formula trigger character", () => {
    for (const trigger of ["=", "+", "-", "@"]) {
      expect(escapeCsvFormula(`${trigger}cmd`)).toBe(`'${trigger}cmd`);
    }
  });

  it("neutralises a leading tab and carriage return", () => {
    expect(escapeCsvFormula("\tcmd")).toBe("'\tcmd");
    expect(escapeCsvFormula("\rcmd")).toBe("'\rcmd");
  });

  it("still guards when the trigger is preceded by spaces", () => {
    // Leading whitespace does not stop a spreadsheet from evaluating the cell.
    expect(escapeCsvFormula("   =SUM(A1)")).toBe("'   =SUM(A1)");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeCsvFormula("Ani Wijaya")).toBe("Ani Wijaya");
    expect(escapeCsvFormula("2026-03-12")).toBe("2026-03-12");
    expect(escapeCsvFormula("")).toBe("");
  });

  it("does not treat a hyphen inside a value as a formula", () => {
    expect(escapeCsvFormula("needs-revision")).toBe("needs-revision");
  });
});

describe("escapeCsvCell", () => {
  it("quotes cells containing a comma", () => {
    expect(escapeCsvCell("Ani, Wijaya")).toBe('"Ani, Wijaya"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvCell('He said "ok"')).toBe('"He said ""ok"""');
  });

  it("quotes cells containing newlines", () => {
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCsvCell("line one\r\nline two")).toBe(
      '"line one\r\nline two"',
    );
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("escapes a formula before quoting", () => {
    expect(escapeCsvCell('=HYPERLINK("http://x","click")')).toBe(
      '"\'=HYPERLINK(""http://x"",""click"")"',
    );
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);

    expect(csv).toBe("a,b\r\n1,2\r\n");
  });

  it("keeps a trailing CRLF so the last record is complete", () => {
    expect(toCsv(["only"], []).endsWith("\r\n")).toBe(true);
  });

  it("guards every body cell", () => {
    const csv = toCsv(["name"], [["=1+1"]]);

    expect(csv).toContain("'=1+1");
  });
});

describe("withBom", () => {
  it("prefixes the byte-order mark", () => {
    expect(withBom("a,b\r\n")).toBe(`${CSV_BOM}a,b\r\n`);
    expect(CSV_BOM).toBe("\uFEFF");
  });
});
