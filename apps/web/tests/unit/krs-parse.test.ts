import {
  krsCourseDraftSchema,
  krsImportConfirmSchema,
} from "@starstask/contracts";
import { describe, expect, it } from "vitest";

import { parseKrsText } from "@/lib/ocr/krs-parse";

const TIMETABLE_KRS_SAMPLE = `FAKULTAS / PRODI : ILMU KOMPUTER / TEKNIK INFORMATIKA S1
NAMA MAHASISWA : BUDI SANTOSO FAKE
NIM : 241011400999
IPK : 3.85
UNIVERSITAS CONTOH
JADWAL KULIAH SEMESTER GANJIL 2026/2027
NO KODE MK NAMA MATA KULIAH DOSEN KELAS HARI WAKTU PERIODE RUANG TGL MULAI TGL SELESAI
1 22TIF0283 PEMROGRAMAN WEB I RINA
KARTIKA 05TPLM002 Senin 18.20 - 20.00 1 V.117 31 Agt 2026 31 Jan 2027
2 22TIF1013 MACHINE LEARNING AGUNG
PRATAMA 05TPLM002 Senin 20.00 - 21.40 1 V.117 31 Agt 2026 31 Jan 2027
3 22TIF0252 SISTEM INFORMASI
MANAJEMEN DANI WIJAYA 05TPLM002 Selasa 20.00 - 21.40 1 V.118 31 Agt 2026 31 Jan 2027`;

const COURSE_ONLY_KRS_SAMPLE = `KARTU RENCANA STUDI (KRS)
Nama Mahasiswa : SITI AMINAH FAKE
NIM : 231011400111
IPS : 3.70
Kelas : TPLM002
Semester : 4
Tahun Akademik : 2024-2025
1 22TIF0101 ALGORITMA DAN PEMROGRAMAN 3 SKS
2 22TIF0102 STRUKTUR DATA | HENDRA WIJAYA 3 SKS`;

describe("parseKrsText", () => {
  it("extracts class identity, courses, and schedules from timetable text", () => {
    const result = parseKrsText(TIMETABLE_KRS_SAMPLE);

    expect(result.classCode).toBe("05TPLM002");
    expect(result.semesterNumber).toBe(5);
    expect(result.academicYear).toBe("2026/2027");
    expect(result.warnings).toEqual([]);
    expect(result.courses).toHaveLength(3);
    expect(result.courses[0]).toEqual({
      courseCode: "22TIF0283",
      courseName: "PEMROGRAMAN WEB I RINA KARTIKA",
      lecturerName: null,
      dayOfWeek: 1,
      startTime: "18:20",
      endTime: "20:00",
      room: "V.117",
    });
    expect(result.courses[2]).toMatchObject({
      courseCode: "22TIF0252",
      dayOfWeek: 2,
      startTime: "20:00",
      endTime: "21:40",
      room: "V.118",
    });
  });

  it("never includes NIM, IPK, or student name in parsed output", () => {
    const result = parseKrsText(TIMETABLE_KRS_SAMPLE);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("241011400999");
    expect(serialized).not.toContain("3.85");
    expect(serialized).not.toContain("BUDI SANTOSO FAKE");
  });

  it("extracts courses without schedule from SKS-only KRS documents", () => {
    const result = parseKrsText(COURSE_ONLY_KRS_SAMPLE);

    expect(result.classCode).toBe("TPLM002");
    expect(result.semesterNumber).toBe(4);
    expect(result.academicYear).toBe("2024/2025");
    expect(result.courses).toEqual([
      {
        courseCode: "22TIF0101",
        courseName: "ALGORITMA DAN PEMROGRAMAN",
        lecturerName: null,
        dayOfWeek: null,
        startTime: null,
        endTime: null,
        room: null,
      },
      {
        courseCode: "22TIF0102",
        courseName: "STRUKTUR DATA",
        lecturerName: "HENDRA WIJAYA",
        dayOfWeek: null,
        startTime: null,
        endTime: null,
        room: null,
      },
    ]);
  });

  it("deduplicates identical course slots", () => {
    const duplicated = `${TIMETABLE_KRS_SAMPLE}
1 22TIF0283 PEMROGRAMAN WEB I RINA KARTIKA 05TPLM002 Senin 18.20 - 20.00 1 V.117 31 Agt 2026 31 Jan 2027`;
    const result = parseKrsText(duplicated);

    expect(result.courses).toHaveLength(3);
  });

  it("returns empty courses on blank input and warns on unparseable text", () => {
    expect(parseKrsText("   ")).toEqual({
      classCode: null,
      semesterNumber: null,
      academicYear: null,
      courses: [],
      warnings: [],
    });

    const unparseable = parseKrsText("Dokumen tidak dikenal tanpa mata kuliah");

    expect(unparseable.courses).toEqual([]);
    expect(unparseable.warnings.length).toBeGreaterThan(0);
  });
});

describe("krsCourseDraftSchema", () => {
  it("accepts a full course draft and a minimal draft with nullable fields", () => {
    const full = krsCourseDraftSchema.parse({
      courseCode: " 22TIF0283 ",
      courseName: " Pemrograman Web I ",
      lecturerName: " Rina Kartika ",
      dayOfWeek: 1,
      startTime: "18:20",
      endTime: "20:00",
      room: " V.117 ",
    });

    expect(full).toEqual({
      courseCode: "22TIF0283",
      courseName: "Pemrograman Web I",
      lecturerName: "Rina Kartika",
      dayOfWeek: 1,
      startTime: "18:20",
      endTime: "20:00",
      room: "V.117",
    });

    const minimal = krsCourseDraftSchema.parse({
      courseCode: "TIF101",
      courseName: "Algoritma",
      lecturerName: "",
      dayOfWeek: null,
      startTime: "",
      endTime: null,
      room: null,
    });

    expect(minimal).toEqual({
      courseCode: "TIF101",
      courseName: "Algoritma",
      lecturerName: null,
      dayOfWeek: null,
      startTime: null,
      endTime: null,
      room: null,
    });
  });

  it("rejects invalid time formats and out-of-range weekdays", () => {
    expect(() =>
      krsCourseDraftSchema.parse({
        courseCode: "TIF101",
        courseName: "Algoritma",
        startTime: "25:00",
      }),
    ).toThrow();

    expect(() =>
      krsCourseDraftSchema.parse({
        courseCode: "TIF101",
        courseName: "Algoritma",
        dayOfWeek: 8,
      }),
    ).toThrow();
  });
});

describe("krsImportConfirmSchema", () => {
  it("normalizes classCode, coerces semesterNumber, and defaults joinPolicy", () => {
    const parsed = krsImportConfirmSchema.parse({
      classCode: " tplm002 ",
      semesterNumber: "5",
      academicYear: "2024/2025",
      courses: [
        {
          courseCode: "22TIF0283",
          courseName: "Pemrograman Web I",
        },
      ],
    });

    expect(parsed.classCode).toBe("TPLM002");
    expect(parsed.semesterNumber).toBe(5);
    expect(parsed.joinPolicy).toBe("invitation");
  });

  it("rejects invalid academicYear, empty courses, and more than 30 courses", () => {
    expect(() =>
      krsImportConfirmSchema.parse({
        classCode: "TPLM002",
        semesterNumber: 5,
        academicYear: "2024-2025",
        courses: [{ courseCode: "TIF101", courseName: "Algoritma" }],
      }),
    ).toThrow();

    expect(() =>
      krsImportConfirmSchema.parse({
        classCode: "TPLM002",
        semesterNumber: 5,
        academicYear: "2024/2025",
        courses: [],
      }),
    ).toThrow();

    const tooMany = Array.from({ length: 31 }, (_, index) => ({
      courseCode: `TIF${index + 1}`,
      courseName: `Course ${index + 1}`,
    }));

    expect(() =>
      krsImportConfirmSchema.parse({
        classCode: "TPLM002",
        semesterNumber: 5,
        academicYear: "2024/2025",
        courses: tooMany,
      }),
    ).toThrow();
  });
});
