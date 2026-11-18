import { describe, expect, it, vi } from "vitest";

import {
  findStudentRow,
  injectAttendanceRows,
  normalizeName,
  normalizeNim,
} from "../src/core";
import type { CalibrationProfile, SyncStudentRecord } from "../src/core";
import { MockDocument, h } from "./dom-mock";

describe("normalization helpers", () => {
  it("normalizes NIM by stripping punctuation and preserving leading zeros", () => {
    expect(normalizeNim(" 0012.34-56 ")).toBe("00123456");
    expect(normalizeNim("a11.2022.00123")).toBe("A11202200123");
    expect(normalizeNim("23/512345/PA/21901")).toBe("23512345PA21901");
  });

  it("normalizes names by lowercasing, stripping punctuation, and collapsing spaces", () => {
    expect(normalizeName("  Budi,   Santoso! ")).toBe("budi santoso");
    expect(normalizeName("Siti Nur'Aini, S.Kom.")).toBe("siti nur aini s kom");
  });
});

describe("findStudentRow", () => {
  it("prioritizes NIM anchor over name and avoids substring digit collisions", () => {
    const doc = new MockDocument([
      h(
        "table",
        {},
        h("thead", {}, h("tr", {}, h("th", {}, "NIM"), h("th", {}, "Nama"))),
        h(
          "tbody",
          {},
          h("tr", {}, h("td", {}, "1234"), h("td", {}, "Budi Santoso")),
          h("tr", {}, h("td", {}, "001.23-4"), h("td", {}, "Ani Wijaya")),
        ),
      ),
    ]);

    const rows = Array.from(doc.querySelectorAll("tr"));
    const matched = new Set<Element>();

    const first = findStudentRow(
      rows,
      { nim: "001234", displayName: "Budi Santoso", status: "hadir" },
      matched,
    );
    expect(first?.matchedBy).toBe("nim");
    expect(first?.row.textContent).toContain("Ani Wijaya");

    const collisionCheck = findStudentRow(
      rows,
      { nim: "123", displayName: "Nobody", status: "hadir" },
      matched,
    );
    expect(collisionCheck).toBeNull();
  });

  it("falls back to normalized name when NIM is null or absent", () => {
    const doc = new MockDocument([
      h(
        "table",
        {},
        h(
          "tbody",
          {},
          h("tr", {}, h("td", {}, "99999"), h("td", {}, "Rina Kusuma")),
        ),
      ),
    ]);

    const rows = Array.from(doc.querySelectorAll("tr"));
    const result = findStudentRow(
      rows,
      { nim: null, displayName: "  Rina, Kusuma! ", status: "izin" },
      new Set<Element>(),
    );

    expect(result?.matchedBy).toBe("name-fallback");
  });
});

describe("injectAttendanceRows heuristics and events", () => {
  it("injects radio controls and dispatches input/change events", async () => {
    const r1H = h("input", { type: "radio", name: "s1", value: "H" });
    const r1I = h("input", { type: "radio", name: "s1", value: "I" });
    const r1S = h("input", { type: "radio", name: "s1", value: "S" });
    const r1A = h("input", { type: "radio", name: "s1", value: "A" });

    const r2H = h("input", { type: "radio", name: "s2", value: "1" });
    const r2A = h("input", { type: "radio", name: "s2", value: "0" });

    const onChangeSpy = vi.fn();
    const onInputSpy = vi.fn();
    r1S.addEventListener("change", onChangeSpy);
    r1S.addEventListener("input", onInputSpy);

    const row1 = h(
      "tr",
      {},
      h("td", {}, "220101"),
      h("td", {}, "Andi Pratama"),
      h("td", {}, r1H, r1I, r1S, r1A),
    );
    const row2 = h(
      "tr",
      {},
      h("td", {}, "220102"),
      h("td", {}, "Dewi Lestari"),
      h("td", {}, r2H, r2A),
    );

    const doc = new MockDocument([h("table", {}, h("tbody", {}, row1, row2))]);
    const students: SyncStudentRecord[] = [
      { nim: "220101", displayName: "Andi Pratama", status: "sakit" },
      { nim: null, displayName: "Dewi Lestari", status: "alpa" },
      { nim: "999999", displayName: "Tidak Ada", status: "hadir" },
    ];

    const progressCalls: Array<[number, number]> = [];
    const summary = await injectAttendanceRows(
      doc as unknown as Document,
      students,
      {
        delayMs: 0,
        onProgress: (done, total) => progressCalls.push([done, total]),
      },
    );

    expect(r1S.checked).toBe(true);
    expect(r2A.checked).toBe(true);
    expect(onInputSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(row1.style.backgroundColor).toBe("#dcfce7");
    expect(row2.style.backgroundColor).toBe("#fef9c3");
    expect(summary.matchedByNim).toBe(1);
    expect(summary.matchedByNameFallback).toBe(1);
    expect(summary.unmatched).toBe(1);
    expect(progressCalls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("injects select dropdowns case-insensitively", async () => {
    const select = h(
      "select",
      {},
      h("option", { value: "" }, "-- Pilih --"),
      h("option", { value: "H" }, "Hadir"),
      h("option", { value: "I" }, "Izin"),
      h("option", { value: "S" }, "Sakit"),
      h("option", { value: "A" }, "Alpha"),
    );
    const changeSpy = vi.fn();
    select.addEventListener("change", changeSpy);

    const doc = new MockDocument([
      h(
        "table",
        {},
        h(
          "tbody",
          {},
          h(
            "tr",
            {},
            h("td", {}, "220201"),
            h("td", {}, "Fajar Nugroho"),
            h("td", {}, select),
          ),
        ),
      ),
    ]);

    const summary = await injectAttendanceRows(
      doc as unknown as Document,
      [{ nim: "220201", displayName: "Fajar Nugroho", status: "alpa" }],
      { delayMs: 0 },
    );

    expect(summary.matchedByNim).toBe(1);
    expect(summary.results[0]?.applied).toBe(true);
    expect(select.value).toBe("A");
    expect(changeSpy).toHaveBeenCalledTimes(1);
  });

  it("detects multi-column status checkboxes from table headers", async () => {
    const cbH = h("input", { type: "checkbox" });
    const cbI = h("input", { type: "checkbox" });
    const cbS = h("input", { type: "checkbox" });
    const cbA = h("input", { type: "checkbox" });

    const doc = new MockDocument([
      h(
        "table",
        {},
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", {}, "NIM"),
            h("th", {}, "Nama"),
            h("th", {}, "Hadir"),
            h("th", {}, "Izin"),
            h("th", {}, "Sakit"),
            h("th", {}, "Alpa"),
          ),
        ),
        h(
          "tbody",
          {},
          h(
            "tr",
            {},
            h("td", {}, "220301"),
            h("td", {}, "Gita Permata"),
            h("td", {}, cbH),
            h("td", {}, cbI),
            h("td", {}, cbS),
            h("td", {}, cbA),
          ),
        ),
      ),
    ]);

    const summary = await injectAttendanceRows(
      doc as unknown as Document,
      [{ nim: "220301", displayName: "Gita Permata", status: "izin" }],
      { delayMs: 0 },
    );

    expect(summary.results[0]?.applied).toBe(true);
    expect(cbI.checked).toBe(true);
    expect(cbH.checked).toBe(false);
  });

  it("scopes to targetColumnIndex for multi-column meeting grids", async () => {
    const p1 = h("input", { type: "checkbox" });
    const p2 = h("input", { type: "checkbox" });
    const p3 = h("input", { type: "checkbox" });

    const doc = new MockDocument([
      h(
        "table",
        {},
        h(
          "tbody",
          {},
          h(
            "tr",
            {},
            h("td", {}, "220401"),
            h("td", {}, "Hendra"),
            h("td", {}, p1),
            h("td", {}, p2),
            h("td", {}, p3),
          ),
        ),
      ),
    ]);

    const calibration: CalibrationProfile = {
      origin: "https://siakad.example.ac.id",
      targetColumnIndex: 3,
      mode: "checkbox",
      updatedAt: "2026-11-18T00:00:00.000Z",
    };

    await injectAttendanceRows(
      doc as unknown as Document,
      [{ nim: "220401", displayName: "Hendra", status: "hadir" }],
      { delayMs: 0, calibration },
    );

    expect(p1.checked).toBe(false);
    expect(p2.checked).toBe(true);
    expect(p3.checked).toBe(false);
  });

  it("highlights matched rows in dry-run mode without mutating inputs", async () => {
    const checkbox = h("input", { type: "checkbox" });
    const row = h("tr", {}, h("td", {}, "220501"), h("td", {}, checkbox));
    const doc = new MockDocument([h("table", {}, h("tbody", {}, row))]);

    const summary = await injectAttendanceRows(
      doc as unknown as Document,
      [{ nim: "220501", displayName: "Indra", status: "hadir" }],
      { dryRun: true },
    );

    expect(summary.matchedByNim).toBe(1);
    expect(summary.results[0]?.applied).toBe(false);
    expect(checkbox.checked).toBe(false);
    expect(row.style.backgroundColor).toBe("#dcfce7");
  });
});
