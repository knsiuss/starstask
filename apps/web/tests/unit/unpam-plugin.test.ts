import { describe, expect, it } from "vitest";

import {
  detectProgramId,
  filterEventsByProgram,
  isUnpamUniversity,
  parseProgramParam,
} from "@/features/plugins/unpam/config";
import {
  extractAnnouncementTitle,
  findIndonesianDates,
  parseIndonesianDate,
  parseKalenderRows,
  parseMentariPeriods,
  parsePengumuman,
} from "@/features/plugins/unpam/adapter";

describe("parseIndonesianDate", () => {
  it("converts Indonesian date to ISO", () => {
    expect(parseIndonesianDate("02 November 2026")).toBe("2026-11-02");
    expect(parseIndonesianDate("25 November 2026")).toBe("2026-11-25");
  });

  it("returns null for unparseable input", () => {
    expect(parseIndonesianDate("November 2026")).toBeNull();
    expect(parseIndonesianDate("")).toBeNull();
  });
});

describe("findIndonesianDates", () => {
  it("finds all dates in order without duplicates", () => {
    const text =
      "Pendaftaran s.d 11 November 2026, pelaksanaan 25 November 2026";
    expect(findIndonesianDates(text)).toEqual(["2026-11-11", "2026-11-25"]);
  });

  it("returns empty array when no dates", () => {
    expect(findIndonesianDates("Hari ini mahasiswa libur")).toEqual([]);
  });
});

describe("parseKalenderRows", () => {
  it("parses academic calendar table rows", () => {
    const html = `
      <table>
        <tr><th>#</th><th>Tanggal Awal</th><th>Tanggal Akhir</th><th>Kegiatan</th></tr>
        <tr><td>1</td><td>02 November 2026</td><td>06 November 2026</td><td>Online Learning mahasiswa Reguler A & B</td></tr>
      </table>`;

    const events = parseKalenderRows(html);

    expect(events).toHaveLength(1);
    expect(events[0]?.startsAt).toBe("2026-11-02");
    expect(events[0]?.endsAt).toBe("2026-11-06");
    expect(events[0]?.kind).toBe("academic-calendar");
  });
});

describe("parseMentariPeriods", () => {
  it("parses Periode Daring windows", () => {
    const html = `<p>JADWAL MANAJEMEN TERPADU PEMBELAJARAN DARING (MENTARI)</p><p>Periode Daring 02-11-2026 s.d 06-11-2026 2 SKS - Pertemuan 9</p>`;

    const events = parseMentariPeriods(html);

    expect(events).toHaveLength(1);
    expect(events[0]?.startsAt).toBe("2026-11-02");
    expect(events[0]?.endsAt).toBe("2026-11-06");
    expect(events[0]?.description).toContain("Pertemuan 9");
  });
});

describe("parsePengumuman", () => {
  it("extracts title and dates from INFORMASI block", () => {
    const html = `<p>INFORMASI Seminar Nasional Teknik Informatika "Preparing Future Talent". Pendaftaran s.d 11 November 2026, pelaksanaan 25 November 2026.</p>`;

    const events = parsePengumuman(html);

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toContain("Seminar Nasional");
    expect(events[0]?.startsAt).toBe("2026-11-11");
    expect(events[0]?.endsAt).toBe("2026-11-25");
    expect(events[0]?.programId).toBe("ti");
    expect(events[0]?.kind).toBe("events");
    expect(events[0]?.sourceUrl).toBe("https://ftiunpam.com/pengumuman");
  });

  it("extracts fallback title when no sentence dot", () => {
    expect(
      extractAnnouncementTitle("Pelaksanaan UTS susulan gelombang kedua"),
    ).toBe("Pelaksanaan UTS susulan gelombang kedua");
  });
});

describe("detectProgramId / filterEventsByProgram", () => {
  it("detects ti from Teknik Informatika text", () => {
    expect(detectProgramId("Seminar Nasional Teknik Informatika")).toBe("ti");
  });

  it("detects manajemen from Manajemen text", () => {
    expect(detectProgramId("Kuliah Umum Manajemen Bisnis")).toBe("manajemen");
  });

  it("defaults to semua otherwise", () => {
    expect(detectProgramId("Libur nasional")).toBe("semua");
  });

  it("filters ti to ti + semua events", () => {
    const events = [
      { programId: "ti" as const },
      { programId: "manajemen" as const },
      { programId: "semua" as const },
    ];

    expect(filterEventsByProgram(events, "ti")).toHaveLength(2);
    expect(filterEventsByProgram(events, "semua")).toHaveLength(3);
  });
});

describe("isUnpamUniversity / parseProgramParam", () => {
  it("matches pamulang and unpam", () => {
    expect(isUnpamUniversity("Universitas Pamulang")).toBe(true);
    expect(isUnpamUniversity("UNPAM")).toBe(true);
    expect(isUnpamUniversity("Universitas Indonesia")).toBe(false);
    expect(isUnpamUniversity(null)).toBe(false);
  });

  it("parses program param safely", () => {
    expect(parseProgramParam("ti")).toBe("ti");
    expect(parseProgramParam("manajemen")).toBe("manajemen");
    expect(parseProgramParam("bogus")).toBe("semua");
    expect(parseProgramParam(undefined)).toBe("semua");
  });
});
