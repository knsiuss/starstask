import {
  getControlCandidatesText,
  getElementCellIndex,
  matchStatusText,
} from "./heuristics";
import type { SyncAttendanceStatus } from "./types";

function dispatchInputEvents(el: Element): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function triggerClick(el: Element): void {
  if (typeof (el as HTMLElement).click === "function") {
    (el as HTMLElement).click();
    return;
  }

  el.dispatchEvent(new Event("click", { bubbles: true }));
}

export function setNativeChecked(
  input: HTMLInputElement,
  checked: boolean,
): void {
  const proto =
    typeof HTMLInputElement !== "undefined"
      ? HTMLInputElement.prototype
      : Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "checked");

  if (descriptor?.set) {
    descriptor.set.call(input, checked);
  } else {
    input.checked = checked;
  }

  dispatchInputEvents(input);
}

export function setNativeValue(
  el: HTMLInputElement | HTMLSelectElement,
  value: string,
): void {
  const isSelect = el.tagName.toUpperCase() === "SELECT";
  const proto = isSelect
    ? typeof HTMLSelectElement !== "undefined"
      ? HTMLSelectElement.prototype
      : Object.getPrototypeOf(el)
    : typeof HTMLInputElement !== "undefined"
      ? HTMLInputElement.prototype
      : Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");

  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }

  dispatchInputEvents(el);
}

export function applyControlElement(
  el: Element,
  targetStatus: SyncAttendanceStatus,
): boolean {
  const tag = el.tagName.toUpperCase();

  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    const type = (input.getAttribute("type") ?? "text").toLowerCase();

    if (type === "radio") {
      setNativeChecked(input, true);
      return true;
    }

    if (type === "checkbox") {
      setNativeChecked(input, targetStatus === "hadir");
      return true;
    }

    setNativeValue(input, targetStatus);
    return true;
  }

  if (tag === "SELECT") {
    return applySelectHeuristic(el as HTMLSelectElement, targetStatus);
  }

  if (tag === "BUTTON" || el.getAttribute("role") === "button") {
    triggerClick(el);
    return true;
  }

  return false;
}

export function applySelectHeuristic(
  select: HTMLSelectElement,
  targetStatus: SyncAttendanceStatus,
): boolean {
  const options = Array.from(select.querySelectorAll("option"));

  for (const option of options) {
    const optVal = option.getAttribute("value") ?? "";
    const optText = option.textContent ?? "";

    if (
      matchStatusText(optText) === targetStatus ||
      matchStatusText(optVal) === targetStatus
    ) {
      setNativeValue(select, optVal || optText);
      return true;
    }
  }

  return false;
}

function resolveControlStatus(
  el: Element,
  doc: Document,
  row: Element,
  headerStatusMap: Map<number, SyncAttendanceStatus>,
): SyncAttendanceStatus | null {
  const candidates = getControlCandidatesText(el, doc);
  for (const text of candidates) {
    const matched = matchStatusText(text);
    if (matched) {
      return matched;
    }
  }

  const cellIndex = getElementCellIndex(row, el);
  if (cellIndex !== undefined) {
    return headerStatusMap.get(cellIndex) ?? null;
  }

  return null;
}

export function applyRadioHeuristic(
  radios: HTMLInputElement[],
  targetStatus: SyncAttendanceStatus,
  doc: Document,
  row: Element,
  headerStatusMap: Map<number, SyncAttendanceStatus>,
): boolean {
  for (const radio of radios) {
    if (
      resolveControlStatus(radio, doc, row, headerStatusMap) === targetStatus
    ) {
      setNativeChecked(radio, true);
      return true;
    }
  }

  const fallbackIndex: Record<SyncAttendanceStatus, number> = {
    hadir: 0,
    izin: 1,
    sakit: 2,
    alpa: radios.length - 1,
  };
  const fallbackRadio = radios[fallbackIndex[targetStatus]];

  if (fallbackRadio && radios.length >= 2) {
    setNativeChecked(fallbackRadio, true);
    return true;
  }

  return false;
}

export function applyCheckboxHeuristic(
  checkboxes: HTMLInputElement[],
  targetStatus: SyncAttendanceStatus,
  doc: Document,
  row: Element,
  headerStatusMap: Map<number, SyncAttendanceStatus>,
): boolean {
  if (checkboxes.length === 1) {
    const single = checkboxes[0];
    if (!single) {
      return false;
    }

    setNativeChecked(single, targetStatus === "hadir");
    return true;
  }

  let targetCheckbox: HTMLInputElement | undefined;
  for (const cb of checkboxes) {
    if (resolveControlStatus(cb, doc, row, headerStatusMap) === targetStatus) {
      targetCheckbox = cb;
      break;
    }
  }

  if (!targetCheckbox && checkboxes.length === 4) {
    const positionalMap: Record<SyncAttendanceStatus, number> = {
      hadir: 0,
      izin: 1,
      sakit: 2,
      alpa: 3,
    };
    targetCheckbox = checkboxes[positionalMap[targetStatus]];
  }

  if (!targetCheckbox) {
    return false;
  }

  for (const cb of checkboxes) {
    if (cb !== targetCheckbox && cb.checked) {
      setNativeChecked(cb, false);
    }
  }

  setNativeChecked(targetCheckbox, true);
  return true;
}

export function applyButtonHeuristic(
  buttons: Element[],
  targetStatus: SyncAttendanceStatus,
  doc: Document,
  row: Element,
  headerStatusMap: Map<number, SyncAttendanceStatus>,
): boolean {
  for (const btn of buttons) {
    if (resolveControlStatus(btn, doc, row, headerStatusMap) === targetStatus) {
      triggerClick(btn);
      return true;
    }
  }

  return false;
}
