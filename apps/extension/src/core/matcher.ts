import type { SyncStudentRecord } from "./types";

const CELL_SELECTOR = "td, th, [role='cell'], [role='gridcell']";
const DATA_CELL_SELECTOR = "td, [role='cell'], [role='gridcell']";
const HEADER_CELL_SELECTOR = "th, [role='columnheader']";

export function normalizeNim(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeaderOnlyRow(row: Element): boolean {
  if (row.closest("thead") !== null) {
    return true;
  }

  const dataCells = row.querySelectorAll(DATA_CELL_SELECTOR);
  if (dataCells.length > 0) {
    return false;
  }

  return row.querySelectorAll(HEADER_CELL_SELECTOR).length > 0;
}

function containsNimWithBoundary(
  normalizedText: string,
  targetNim: string,
): boolean {
  let startIndex = 0;

  while (startIndex <= normalizedText.length - targetNim.length) {
    const idx = normalizedText.indexOf(targetNim, startIndex);
    if (idx === -1) {
      return false;
    }

    const beforeChar = idx > 0 ? normalizedText[idx - 1] : undefined;
    const afterChar =
      idx + targetNim.length < normalizedText.length
        ? normalizedText[idx + targetNim.length]
        : undefined;

    const startsWithDigit = /^\d/.test(targetNim);
    const endsWithDigit = /\d$/.test(targetNim);

    const beforeConflict =
      startsWithDigit && beforeChar !== undefined && /\d/.test(beforeChar);
    const afterConflict =
      endsWithDigit && afterChar !== undefined && /\d/.test(afterChar);

    if (!beforeConflict && !afterConflict) {
      return true;
    }

    startIndex = idx + 1;
  }

  return false;
}

function containsWholePhrase(
  normalizedText: string,
  targetName: string,
): boolean {
  if (normalizedText === targetName) {
    return true;
  }

  const paddedText = ` ${normalizedText} `;
  return paddedText.includes(` ${targetName} `);
}

export function findStudentRow(
  rows: Element[],
  student: SyncStudentRecord,
  alreadyMatched: Set<Element>,
): { row: Element; matchedBy: "nim" | "name-fallback" } | null {
  const candidates = rows.filter(
    (row) => !alreadyMatched.has(row) && !isHeaderOnlyRow(row),
  );

  const targetNim = student.nim ? normalizeNim(student.nim) : "";

  if (targetNim.length > 0) {
    for (const row of candidates) {
      const cells = Array.from(row.querySelectorAll(CELL_SELECTOR));
      for (const cell of cells) {
        if (normalizeNim(cell.textContent ?? "") === targetNim) {
          return { row, matchedBy: "nim" };
        }
      }
    }

    for (const row of candidates) {
      const cells = Array.from(row.querySelectorAll(CELL_SELECTOR));
      const matchedInCell = cells.some((cell) =>
        containsNimWithBoundary(
          normalizeNim(cell.textContent ?? ""),
          targetNim,
        ),
      );

      if (
        matchedInCell ||
        containsNimWithBoundary(normalizeNim(row.textContent ?? ""), targetNim)
      ) {
        return { row, matchedBy: "nim" };
      }
    }
  }

  const targetName = normalizeName(student.displayName);
  if (targetName.length === 0) {
    return null;
  }

  for (const row of candidates) {
    const cells = Array.from(row.querySelectorAll(CELL_SELECTOR));
    for (const cell of cells) {
      if (normalizeName(cell.textContent ?? "") === targetName) {
        return { row, matchedBy: "name-fallback" };
      }
    }
  }

  for (const row of candidates) {
    if (containsWholePhrase(normalizeName(row.textContent ?? ""), targetName)) {
      return { row, matchedBy: "name-fallback" };
    }
  }

  return null;
}
