"use client";

/**
 * Semester rolling helper:
 * - Deteksi tahun ajaran baru dari kode "2024/2025" -> next "2025/2026"
 * - Generate semester codes 1..7 (ganjil/genap + sisipan)
 */
export function nextAcademicYear(code: string): string | null {
  const match = code.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return `${start + 1}/${end + 1}`;
}

export function semesterCodeFor(sequence: number): string {
  return String(sequence);
}

export function isNewSemesterNeeded(
  currentCode: string,
  today = new Date(),
): boolean {
  const next = nextAcademicYear(currentCode);
  if (!next) return false;
  const [nextStart] = next.split("/");
  return today.getFullYear() >= Number(nextStart);
}
