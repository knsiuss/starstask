import { getRowCells } from "./heuristics";
import type { CalibrationProfile, SyncAttendanceStatus } from "./types";

const CALIBRATION_STEPS: readonly SyncAttendanceStatus[] = [
  "hadir",
  "izin",
  "sakit",
  "alpa",
];

function formatStepPrompt(status: SyncAttendanceStatus): string {
  return `Click control for "${status.toUpperCase()}" on the first student row (Enter to finish, Esc to cancel).`;
}

function resolveControlTarget(
  rawTarget: Element,
  doc: Document,
): Element | null {
  const direct = rawTarget.closest("input, select, button, [role='button']");
  if (direct) {
    return direct;
  }

  const label = rawTarget.closest("label");
  if (!label) {
    return null;
  }

  const nested = label.querySelector("input, select, button, [role='button']");
  if (nested) {
    return nested;
  }

  const forId = label.getAttribute("for");
  if (forId) {
    return doc.getElementById(forId);
  }

  return null;
}

function detectControlMode(
  control: Element,
): CalibrationProfile["mode"] | undefined {
  const tag = control.tagName.toUpperCase();

  if (tag === "SELECT") {
    return "select";
  }

  if (tag === "BUTTON" || control.getAttribute("role") === "button") {
    return "button";
  }

  if (tag === "INPUT") {
    const type = (control.getAttribute("type") ?? "text").toLowerCase();
    if (type === "radio") {
      return "radio";
    }
    if (type === "checkbox") {
      return "checkbox";
    }
  }

  return undefined;
}

function getNthOfTypeIndex(el: Element): number {
  const parent = el.parentElement;
  if (!parent) {
    return 1;
  }

  const tag = el.tagName.toUpperCase();
  const sameTagSiblings = Array.from(parent.children).filter(
    (child) => child.tagName.toUpperCase() === tag,
  );

  const index = sameTagSiblings.indexOf(el);
  return index >= 0 ? index + 1 : 1;
}

function buildRelativeSelector(row: Element, target: Element): string {
  const segments: string[] = [];
  let current: Element | null = target;

  while (current && current !== row) {
    const tag = current.tagName.toLowerCase();
    const nth = getNthOfTypeIndex(current);
    let segment = `${tag}:nth-of-type(${nth})`;

    if (tag === "input") {
      const type = current.getAttribute("type");
      if (type) {
        segment = `${tag}[type="${type}"]:nth-of-type(${nth})`;
      }
    }

    segments.unshift(segment);
    current = current.parentElement;
  }

  return segments.join(" > ");
}

function getCellIndexInRow(row: Element, control: Element): number | undefined {
  const cell = control.closest("td, th, [role='cell'], [role='gridcell']");
  if (!cell) {
    return undefined;
  }

  const tableCell = cell as HTMLTableCellElement;
  if (typeof tableCell.cellIndex === "number" && tableCell.cellIndex >= 0) {
    return tableCell.cellIndex;
  }

  const cells = getRowCells(row);
  const idx = cells.indexOf(cell);
  return idx >= 0 ? idx : undefined;
}

export function startCalibrationSession(
  doc: Document,
  onComplete: (profile: CalibrationProfile) => void,
  onStep?: (stepPrompt: string) => void,
): () => void {
  let stepIndex = 0;
  let disposed = false;
  let targetColumnIndex: number | undefined;
  let mode: CalibrationProfile["mode"] | undefined;
  const statusSelectors: Partial<Record<SyncAttendanceStatus, string>> = {};

  const buildProfile = (): CalibrationProfile => {
    const origin =
      doc.location?.origin ??
      (typeof window !== "undefined" ? window.location.origin : "");

    return {
      origin,
      targetColumnIndex,
      statusSelectors,
      mode,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleClick = (event: Event): void => {
    if (disposed) {
      return;
    }

    const rawTarget = event.target as Element | null;
    if (!rawTarget) {
      return;
    }

    const control = resolveControlTarget(rawTarget, doc);
    if (!control) {
      return;
    }

    const row = control.closest("tr, [role='row']");
    if (!row) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentStatus = CALIBRATION_STEPS[stepIndex];
    if (!currentStatus) {
      return;
    }

    if (targetColumnIndex === undefined) {
      targetColumnIndex = getCellIndexInRow(row, control);
    }

    if (!mode) {
      mode = detectControlMode(control);
    }

    statusSelectors[currentStatus] = buildRelativeSelector(row, control);
    stepIndex += 1;

    const nextStatus = CALIBRATION_STEPS[stepIndex];
    if (!nextStatus) {
      cleanup();
      onComplete(buildProfile());
      return;
    }

    onStep?.(formatStepPrompt(nextStatus));
  };

  const handleKeyDown = (event: Event): void => {
    if (disposed) {
      return;
    }

    const key = (event as KeyboardEvent).key;
    if (key === "Escape") {
      cleanup();
      return;
    }

    if (key === "Enter" && Object.keys(statusSelectors).length > 0) {
      event.preventDefault();
      cleanup();
      onComplete(buildProfile());
    }
  };

  const cleanup = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    doc.removeEventListener("click", handleClick, { capture: true });
    doc.removeEventListener("keydown", handleKeyDown, { capture: true });
  };

  doc.addEventListener("click", handleClick, { capture: true });
  doc.addEventListener("keydown", handleKeyDown, { capture: true });

  const firstStatus = CALIBRATION_STEPS[0];
  if (firstStatus) {
    onStep?.(formatStepPrompt(firstStatus));
  }

  return cleanup;
}
