import { normalizeName } from "./matcher";
import type { SyncAttendanceStatus } from "./types";

const EXACT_STATUS_ALIASES: Record<SyncAttendanceStatus, readonly string[]> = {
  hadir: ["h", "1", "hadir", "present", "masuk"],
  izin: ["i", "2", "izin", "ijin", "excused", "leave"],
  sakit: ["s", "3", "sakit", "sick"],
  alpa: ["a", "0", "4", "alpa", "alpha", "absent", "absen", "tidak hadir"],
};

const CONTAINS_STATUS_ALIASES: Record<SyncAttendanceStatus, readonly string[]> =
  {
    hadir: ["hadir", "present"],
    izin: ["izin", "ijin", "excused"],
    sakit: ["sakit", "sick"],
    alpa: ["alpa", "alpha", "absent", "tidak hadir"],
  };

const STATUS_ORDER: readonly SyncAttendanceStatus[] = [
  "hadir",
  "izin",
  "sakit",
  "alpa",
];

export function matchStatusText(raw: string): SyncAttendanceStatus | null {
  const normalized = normalizeName(raw);
  if (normalized.length === 0) {
    return null;
  }

  for (const status of STATUS_ORDER) {
    if (EXACT_STATUS_ALIASES[status].includes(normalized)) {
      return status;
    }
  }

  const tokens = normalized.split(" ");
  for (const status of STATUS_ORDER) {
    const exactList = EXACT_STATUS_ALIASES[status];
    if (tokens.some((token) => exactList.includes(token))) {
      return status;
    }
  }

  for (const status of STATUS_ORDER) {
    const containsList = CONTAINS_STATUS_ALIASES[status];
    if (containsList.some((alias) => normalized.includes(alias))) {
      return status;
    }
  }

  return null;
}

export function getRowCells(row: Element): Element[] {
  return Array.from(
    row.querySelectorAll("td, th, [role='cell'], [role='gridcell']"),
  );
}

export function detectHeaderStatusColumns(
  doc: Document,
): Map<number, SyncAttendanceStatus> {
  const result = new Map<number, SyncAttendanceStatus>();

  const headerRows = Array.from(doc.querySelectorAll("thead tr"));
  let headerCells: Element[] = [];

  const lastHeaderRow = headerRows[headerRows.length - 1];
  if (lastHeaderRow) {
    headerCells = Array.from(
      lastHeaderRow.querySelectorAll("th, td, [role='columnheader']"),
    );
  } else {
    const roleHeaders = Array.from(
      doc.querySelectorAll("[role='columnheader']"),
    );
    if (roleHeaders.length > 0) {
      headerCells = roleHeaders;
    } else {
      const firstTr = doc.querySelector("tr");
      if (firstTr) {
        const ths = Array.from(firstTr.querySelectorAll("th"));
        if (ths.length > 0) {
          headerCells = Array.from(firstTr.querySelectorAll("th, td"));
        }
      }
    }
  }

  headerCells.forEach((cell, index) => {
    const status = matchStatusText(cell.textContent ?? "");
    if (status) {
      result.set(index, status);
    }
  });

  return result;
}

export function getControlCandidatesText(el: Element, doc: Document): string[] {
  const texts: string[] = [];

  const valueAttr = el.getAttribute("value");
  if (valueAttr) {
    texts.push(valueAttr);
  }

  const titleAttr = el.getAttribute("title");
  if (titleAttr) {
    texts.push(titleAttr);
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    texts.push(ariaLabel);
  }

  const dataStatus = el.getAttribute("data-status");
  if (dataStatus) {
    texts.push(dataStatus);
  }

  const parentLabel = el.closest("label");
  if (parentLabel?.textContent) {
    texts.push(parentLabel.textContent);
  }

  const id = el.getAttribute("id");
  if (id) {
    const forLabel = doc.querySelector(`label[for="${id}"]`);
    if (forLabel?.textContent) {
      texts.push(forLabel.textContent);
    }
  }

  const nextSiblingText = el.nextSibling?.textContent?.trim();
  if (nextSiblingText) {
    texts.push(nextSiblingText);
  }

  if (el.textContent?.trim()) {
    texts.push(el.textContent);
  }

  return texts;
}

export function getElementCellIndex(
  row: Element,
  el: Element,
): number | undefined {
  const cell = el.closest("td, th, [role='cell'], [role='gridcell']");
  if (!cell) {
    return undefined;
  }

  const cells = getRowCells(row);
  const idx = cells.indexOf(cell);
  return idx >= 0 ? idx : undefined;
}
