import { describe, expect, it } from "vitest";

import { parseScheduleText } from "@/lib/ocr/schedule-parse";

// Text layer of a Universitas Pamulang KHS schedule PDF, as extracted by
// the pdf-text provider (unpdf). Kept verbatim, including wrapped cells.
const SAMPLE = `FAKULTAS / PRODI
NAMA MAHASISWA
NIM
SHIFT
: ILMU KOMPUTER / TEKNIK INFORMATIKA S1
: P. KANISIUS BAGASKARA
: 241011400306
: REGULER B
UNIVERSITAS PAMULANG
JADWAL KULIAH SEMESTER GANJIL 2026/2027
Tangerang Selatan, 27 Agustus 2026
Ketua Program Studi
Dr. Eng. Ahmad Musyafa, S.Kom., M.Kom.
NIDN. 0425018609
NO KODE MK NAMA MATA KULIAH DOSEN KELAS HARI WAKTU PERIODE RUANG TGL MULAI TGL SELESAI
1 22TIF0283 PEMROGRAMAN WEB I DEDE
SUNANDAR 05TPLM002 Senin 18.20 - 20.00 1 V.117 31 Agt 2026 31 Jan 2027
2 22TIF1013 MACHINE LEARNING AGUNG
PERDANANTO 05TPLM002 Senin 20.00 - 21.40 1 V.117 31 Agt 2026 31 Jan 2027
3 22TIF0252 SISTEM INFORMASI
MANAJEMEN DANI RAMDANI 05TPLM002 Selasa 20.00 - 21.40 1 V.117 31 Agt 2026 31 Jan 2027
4 22TIF0293 METODE PENELITIAN AGUS WIRANTO 05TPLM002 Rabu 18.20 - 20.00 1 V.117 31 Agt 2026 31 Jan 2027
5 22TIF0243 KECERDASAN BUATAN DANI 05TPLM002 Rabu 20.00 - 21.40 1 V.117 31 Agt 2026 31 Jan 2027
6 22TIF0302 DIGITAL
ENTREPRENEURSHIP
NANA
HERMANSYAH 05TPLM002 Kamis 18.20 - 20.00 1 V.117 31 Agt 2026 31 Jan 2027
7 22TIF0272 TEKNIK RISET OPERASIONAL
ADE PUTRA
PRIMA
SUHENDRI
05TPLM002 Kamis 20.00 - 21.40 1 V.117 31 Agt 2026 31 Jan 2027
8 22TIF0262 PENGOLAHAN CITRA
DIGITAL
DIMAS
LENDENSI 05TPLM002 Jumat 18.20 - 20.00 1 V.117 31 Agt 2026 31 Jan 2027`;

describe("parseScheduleText", () => {
  it("reads every row of the sample timetable", () => {
    const { rows, warnings } = parseScheduleText(SAMPLE);

    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(8);
  });

  it("extracts day, time, room, period, and semester range", () => {
    const { rows } = parseScheduleText(SAMPLE);
    const first = rows[0];

    expect(first).toMatchObject({
      rowNumber: 1,
      courseCode: "22TIF0283",
      classCode: "05TPLM002",
      dayOfWeek: 1,
      startTime: "18:20",
      endTime: "20:00",
      period: "1",
      room: "V.117",
      startDate: "2026-08-31",
      endDate: "2027-01-31",
    });
  });

  it("maps each Indonesian day name to its ISO weekday", () => {
    const { rows } = parseScheduleText(SAMPLE);

    expect(rows.map((row) => row.dayOfWeek)).toEqual([1, 1, 2, 3, 3, 4, 4, 5]);
  });

  it("rejoins wrapped course names and lecturers into one segment", () => {
    const { rows } = parseScheduleText(SAMPLE);

    expect(rows[5]?.nameSegment).toBe(
      "DIGITAL ENTREPRENEURSHIP NANA HERMANSYAH",
    );
    expect(rows[6]?.nameSegment).toBe(
      "TEKNIK RISET OPERASIONAL ADE PUTRA PRIMA SUHENDRI",
    );
  });

  it("warns instead of guessing a row without a day or time", () => {
    const { rows, warnings } = parseScheduleText(
      "1 22TIF0001 MATEMATIKA BUDI 05TPLM002 Tanpa hari di sini",
    );

    expect(rows).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.rowNumber).toBe(1);
  });

  it("handles empty input", () => {
    expect(parseScheduleText("")).toEqual({ rows: [], warnings: [] });
  });
});
