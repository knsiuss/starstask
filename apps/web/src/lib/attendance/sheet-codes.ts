import type { AttendanceMeetingCellStatus } from "@starstask/contracts";

/** Recorded statuses shown on the sheet, in reference column order. */
export const SHEET_STATUSES = [
  "present",
  "excused",
  "sick",
  "absent",
  "late",
] as const satisfies readonly AttendanceMeetingCellStatus[];

/** Text code per status. Cells never use emoji or checkbox icons. */
export const SHEET_CODES: Record<(typeof SHEET_STATUSES)[number], string> = {
  present: "✓",
  excused: "I",
  sick: "S",
  absent: "A",
  late: "T",
};

/** Subtle status fills (light green/blue/cyan/red/amber). */
export const SHEET_CELL_CLASSES: Record<
  (typeof SHEET_STATUSES)[number],
  string
> = {
  present: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  excused: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sick: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  late: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

/**
 * Labels per locale. The stored value stays `present|excused|sick|absent|late`;
 * only this display map changes per campus/language.
 */
export const SHEET_LABELS = {
  id: {
    present: "Hadir",
    excused: "Izin",
    sick: "Sakit",
    absent: "Alfa",
    late: "Terlambat",
  },
  en: {
    present: "Present",
    excused: "Excused",
    sick: "Sick",
    absent: "Absent",
    late: "Late",
  },
} as const;

export type SheetLocale = keyof typeof SHEET_LABELS;

/**
 * Reference formula: Persentase = (H / Total Pertemuan) × 100. Late does not
 * enter the numerator; `null` when there is no meeting yet.
 */
export function sheetPercentage(
  present: number,
  totalMeetings: number,
): number | null {
  if (totalMeetings === 0) {
    return null;
  }

  return Math.round((present / totalMeetings) * 1_000) / 10;
}

export type SheetTotals = {
  present: number;
  excused: number;
  sick: number;
  absent: number;
  late: number;
};

/** Count one student's cells into the five sheet columns. */
export function sheetTotals(
  cells: Readonly<Record<string, AttendanceMeetingCellStatus>>,
): SheetTotals {
  const totals: SheetTotals = {
    present: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    late: 0,
  };

  for (const status of Object.values(cells)) {
    if (status in totals) {
      totals[status as keyof SheetTotals] += 1;
    }
  }

  return totals;
}
