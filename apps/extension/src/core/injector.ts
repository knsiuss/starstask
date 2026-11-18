import {
  applyButtonHeuristic,
  applyCheckboxHeuristic,
  applyControlElement,
  applyRadioHeuristic,
  applySelectHeuristic,
  setNativeChecked,
  setNativeValue,
} from "./controls";
import { detectHeaderStatusColumns, getRowCells } from "./heuristics";
import { findStudentRow } from "./matcher";
import type {
  CalibrationProfile,
  InjectAttendanceOptions,
  InjectionSummary,
  RowInjectionResult,
  SyncAttendanceStatus,
  SyncStudentRecord,
} from "./types";

export { setNativeChecked, setNativeValue };

const DEFAULT_DELAY_MS = 100;

function applyStatusToRow(
  row: Element,
  targetStatus: SyncAttendanceStatus,
  doc: Document,
  headerStatusMap: Map<number, SyncAttendanceStatus>,
  calibration?: CalibrationProfile,
): { applied: boolean; reason?: string } {
  const calibratedSelector = calibration?.statusSelectors?.[targetStatus];
  if (calibratedSelector) {
    const calibratedEl = row.querySelector(calibratedSelector);
    if (calibratedEl && applyControlElement(calibratedEl, targetStatus)) {
      return { applied: true };
    }
  }

  let scope: Element = row;
  if (calibration?.targetColumnIndex !== undefined) {
    const cells = getRowCells(row);
    const targetCell = cells[calibration.targetColumnIndex];
    if (!targetCell) {
      return {
        applied: false,
        reason: `Target column ${calibration.targetColumnIndex} not found`,
      };
    }

    scope = targetCell;
  }

  const radios = Array.from(
    scope.querySelectorAll("input[type='radio']"),
  ) as HTMLInputElement[];
  if (
    radios.length > 0 &&
    applyRadioHeuristic(radios, targetStatus, doc, row, headerStatusMap)
  ) {
    return { applied: true };
  }

  const selects = Array.from(
    scope.querySelectorAll("select"),
  ) as HTMLSelectElement[];
  for (const select of selects) {
    if (applySelectHeuristic(select, targetStatus)) {
      return { applied: true };
    }
  }

  const checkboxes = Array.from(
    scope.querySelectorAll("input[type='checkbox']"),
  ) as HTMLInputElement[];
  if (
    checkboxes.length > 0 &&
    applyCheckboxHeuristic(checkboxes, targetStatus, doc, row, headerStatusMap)
  ) {
    return { applied: true };
  }

  const buttons = Array.from(scope.querySelectorAll("button, [role='button']"));
  if (
    buttons.length > 0 &&
    applyButtonHeuristic(buttons, targetStatus, doc, row, headerStatusMap)
  ) {
    return { applied: true };
  }

  return { applied: false, reason: "No matching attendance control found" };
}

function highlightRow(
  row: Element,
  matchedBy: "nim" | "name-fallback",
  applied: boolean,
): void {
  const htmlRow = row as HTMLElement;
  if (!htmlRow.style) {
    return;
  }

  if (matchedBy === "nim" && applied) {
    htmlRow.style.backgroundColor = "#dcfce7";
    htmlRow.style.outline = "2px solid #15803d";
  } else {
    htmlRow.style.backgroundColor = "#fef9c3";
    htmlRow.style.outline = "2px solid #a16207";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function injectAttendanceRows(
  doc: Document,
  students: SyncStudentRecord[],
  options: InjectAttendanceOptions = {},
): Promise<InjectionSummary> {
  const delayMs = options.dryRun ? 0 : (options.delayMs ?? DEFAULT_DELAY_MS);
  const rows = Array.from(doc.querySelectorAll("tr, [role='row']"));
  const headerStatusMap = detectHeaderStatusColumns(doc);
  const alreadyMatched = new Set<Element>();
  const results: RowInjectionResult[] = [];

  let matchedByNim = 0;
  let matchedByNameFallback = 0;
  let unmatched = 0;

  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    if (!student) {
      continue;
    }

    const match = findStudentRow(rows, student, alreadyMatched);

    if (!match) {
      unmatched += 1;
      results.push({
        student,
        matchedBy: "unmatched",
        applied: false,
        reason: "Student row not found",
      });
    } else {
      alreadyMatched.add(match.row);
      const outcome = options.dryRun
        ? { applied: false, reason: "Dry-run preview (no input changed)" }
        : applyStatusToRow(
            match.row,
            student.status,
            doc,
            headerStatusMap,
            options.calibration,
          );

      highlightRow(
        match.row,
        match.matchedBy,
        options.dryRun ? true : outcome.applied,
      );

      if (match.matchedBy === "nim") {
        matchedByNim += 1;
      } else {
        matchedByNameFallback += 1;
      }

      results.push({
        student,
        matchedBy: match.matchedBy,
        applied: outcome.applied,
        reason: outcome.reason,
      });
    }

    options.onProgress?.(i + 1, students.length);

    if (delayMs > 0 && i < students.length - 1) {
      await sleep(delayMs);
    }
  }

  return {
    total: students.length,
    matchedByNim,
    matchedByNameFallback,
    unmatched,
    results,
  };
}
