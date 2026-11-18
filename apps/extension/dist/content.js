"use strict";
(() => {
  // src/core/matcher.ts
  var CELL_SELECTOR = "td, th, [role='cell'], [role='gridcell']";
  var DATA_CELL_SELECTOR = "td, [role='cell'], [role='gridcell']";
  var HEADER_CELL_SELECTOR = "th, [role='columnheader']";
  function normalizeNim(raw) {
    return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }
  function normalizeName(raw) {
    return raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  function isHeaderOnlyRow(row) {
    if (row.closest("thead") !== null) {
      return true;
    }
    const dataCells = row.querySelectorAll(DATA_CELL_SELECTOR);
    if (dataCells.length > 0) {
      return false;
    }
    return row.querySelectorAll(HEADER_CELL_SELECTOR).length > 0;
  }
  function containsNimWithBoundary(normalizedText, targetNim) {
    let startIndex = 0;
    while (startIndex <= normalizedText.length - targetNim.length) {
      const idx = normalizedText.indexOf(targetNim, startIndex);
      if (idx === -1) {
        return false;
      }
      const beforeChar = idx > 0 ? normalizedText[idx - 1] : void 0;
      const afterChar = idx + targetNim.length < normalizedText.length ? normalizedText[idx + targetNim.length] : void 0;
      const startsWithDigit = /^\d/.test(targetNim);
      const endsWithDigit = /\d$/.test(targetNim);
      const beforeConflict = startsWithDigit && beforeChar !== void 0 && /\d/.test(beforeChar);
      const afterConflict = endsWithDigit && afterChar !== void 0 && /\d/.test(afterChar);
      if (!beforeConflict && !afterConflict) {
        return true;
      }
      startIndex = idx + 1;
    }
    return false;
  }
  function containsWholePhrase(normalizedText, targetName) {
    if (normalizedText === targetName) {
      return true;
    }
    const paddedText = ` ${normalizedText} `;
    return paddedText.includes(` ${targetName} `);
  }
  function findStudentRow(rows, student, alreadyMatched) {
    const candidates = rows.filter(
      (row) => !alreadyMatched.has(row) && !isHeaderOnlyRow(row)
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
        const matchedInCell = cells.some(
          (cell) => containsNimWithBoundary(
            normalizeNim(cell.textContent ?? ""),
            targetNim
          )
        );
        if (matchedInCell || containsNimWithBoundary(normalizeNim(row.textContent ?? ""), targetNim)) {
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

  // src/core/heuristics.ts
  var EXACT_STATUS_ALIASES = {
    hadir: ["h", "1", "hadir", "present", "masuk"],
    izin: ["i", "2", "izin", "ijin", "excused", "leave"],
    sakit: ["s", "3", "sakit", "sick"],
    alpa: ["a", "0", "4", "alpa", "alpha", "absent", "absen", "tidak hadir"]
  };
  var CONTAINS_STATUS_ALIASES = {
    hadir: ["hadir", "present"],
    izin: ["izin", "ijin", "excused"],
    sakit: ["sakit", "sick"],
    alpa: ["alpa", "alpha", "absent", "tidak hadir"]
  };
  var STATUS_ORDER = [
    "hadir",
    "izin",
    "sakit",
    "alpa"
  ];
  function matchStatusText(raw) {
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
  function getRowCells(row) {
    return Array.from(
      row.querySelectorAll("td, th, [role='cell'], [role='gridcell']")
    );
  }
  function detectHeaderStatusColumns(doc) {
    const result = /* @__PURE__ */ new Map();
    const headerRows = Array.from(doc.querySelectorAll("thead tr"));
    let headerCells = [];
    const lastHeaderRow = headerRows[headerRows.length - 1];
    if (lastHeaderRow) {
      headerCells = Array.from(
        lastHeaderRow.querySelectorAll("th, td, [role='columnheader']")
      );
    } else {
      const roleHeaders = Array.from(
        doc.querySelectorAll("[role='columnheader']")
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
  function getControlCandidatesText(el, doc) {
    const texts = [];
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
  function getElementCellIndex(row, el) {
    const cell = el.closest("td, th, [role='cell'], [role='gridcell']");
    if (!cell) {
      return void 0;
    }
    const cells = getRowCells(row);
    const idx = cells.indexOf(cell);
    return idx >= 0 ? idx : void 0;
  }

  // src/core/calibration.ts
  var CALIBRATION_STEPS = [
    "hadir",
    "izin",
    "sakit",
    "alpa"
  ];
  function formatStepPrompt(status) {
    return `Click control for "${status.toUpperCase()}" on the first student row (Enter to finish, Esc to cancel).`;
  }
  function resolveControlTarget(rawTarget, doc) {
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
  function detectControlMode(control) {
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
    return void 0;
  }
  function getNthOfTypeIndex(el) {
    const parent = el.parentElement;
    if (!parent) {
      return 1;
    }
    const tag = el.tagName.toUpperCase();
    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName.toUpperCase() === tag
    );
    const index = sameTagSiblings.indexOf(el);
    return index >= 0 ? index + 1 : 1;
  }
  function buildRelativeSelector(row, target) {
    const segments = [];
    let current = target;
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
  function getCellIndexInRow(row, control) {
    const cell = control.closest("td, th, [role='cell'], [role='gridcell']");
    if (!cell) {
      return void 0;
    }
    const tableCell = cell;
    if (typeof tableCell.cellIndex === "number" && tableCell.cellIndex >= 0) {
      return tableCell.cellIndex;
    }
    const cells = getRowCells(row);
    const idx = cells.indexOf(cell);
    return idx >= 0 ? idx : void 0;
  }
  function startCalibrationSession(doc, onComplete, onStep) {
    let stepIndex = 0;
    let disposed = false;
    let targetColumnIndex;
    let mode;
    const statusSelectors = {};
    const buildProfile = () => {
      const origin = doc.location?.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
      return {
        origin,
        targetColumnIndex,
        statusSelectors,
        mode,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    };
    const handleClick = (event) => {
      if (disposed) {
        return;
      }
      const rawTarget = event.target;
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
      if (targetColumnIndex === void 0) {
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
    const handleKeyDown = (event) => {
      if (disposed) {
        return;
      }
      const key = event.key;
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
    const cleanup = () => {
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

  // src/core/controls.ts
  function dispatchInputEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function triggerClick(el) {
    if (typeof el.click === "function") {
      el.click();
      return;
    }
    el.dispatchEvent(new Event("click", { bubbles: true }));
  }
  function setNativeChecked(input, checked) {
    const proto = typeof HTMLInputElement !== "undefined" ? HTMLInputElement.prototype : Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "checked");
    if (descriptor?.set) {
      descriptor.set.call(input, checked);
    } else {
      input.checked = checked;
    }
    dispatchInputEvents(input);
  }
  function setNativeValue(el, value) {
    const isSelect = el.tagName.toUpperCase() === "SELECT";
    const proto = isSelect ? typeof HTMLSelectElement !== "undefined" ? HTMLSelectElement.prototype : Object.getPrototypeOf(el) : typeof HTMLInputElement !== "undefined" ? HTMLInputElement.prototype : Object.getPrototypeOf(el);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    dispatchInputEvents(el);
  }
  function applyControlElement(el, targetStatus) {
    const tag = el.tagName.toUpperCase();
    if (tag === "INPUT") {
      const input = el;
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
      return applySelectHeuristic(el, targetStatus);
    }
    if (tag === "BUTTON" || el.getAttribute("role") === "button") {
      triggerClick(el);
      return true;
    }
    return false;
  }
  function applySelectHeuristic(select, targetStatus) {
    const options = Array.from(select.querySelectorAll("option"));
    for (const option of options) {
      const optVal = option.getAttribute("value") ?? "";
      const optText = option.textContent ?? "";
      if (matchStatusText(optText) === targetStatus || matchStatusText(optVal) === targetStatus) {
        setNativeValue(select, optVal || optText);
        return true;
      }
    }
    return false;
  }
  function resolveControlStatus(el, doc, row, headerStatusMap) {
    const candidates = getControlCandidatesText(el, doc);
    for (const text of candidates) {
      const matched = matchStatusText(text);
      if (matched) {
        return matched;
      }
    }
    const cellIndex = getElementCellIndex(row, el);
    if (cellIndex !== void 0) {
      return headerStatusMap.get(cellIndex) ?? null;
    }
    return null;
  }
  function applyRadioHeuristic(radios, targetStatus, doc, row, headerStatusMap) {
    for (const radio of radios) {
      if (resolveControlStatus(radio, doc, row, headerStatusMap) === targetStatus) {
        setNativeChecked(radio, true);
        return true;
      }
    }
    const fallbackIndex = {
      hadir: 0,
      izin: 1,
      sakit: 2,
      alpa: radios.length - 1
    };
    const fallbackRadio = radios[fallbackIndex[targetStatus]];
    if (fallbackRadio && radios.length >= 2) {
      setNativeChecked(fallbackRadio, true);
      return true;
    }
    return false;
  }
  function applyCheckboxHeuristic(checkboxes, targetStatus, doc, row, headerStatusMap) {
    if (checkboxes.length === 1) {
      const single = checkboxes[0];
      if (!single) {
        return false;
      }
      setNativeChecked(single, targetStatus === "hadir");
      return true;
    }
    let targetCheckbox;
    for (const cb of checkboxes) {
      if (resolveControlStatus(cb, doc, row, headerStatusMap) === targetStatus) {
        targetCheckbox = cb;
        break;
      }
    }
    if (!targetCheckbox && checkboxes.length === 4) {
      const positionalMap = {
        hadir: 0,
        izin: 1,
        sakit: 2,
        alpa: 3
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
  function applyButtonHeuristic(buttons, targetStatus, doc, row, headerStatusMap) {
    for (const btn of buttons) {
      if (resolveControlStatus(btn, doc, row, headerStatusMap) === targetStatus) {
        triggerClick(btn);
        return true;
      }
    }
    return false;
  }

  // src/core/injector.ts
  var DEFAULT_DELAY_MS = 100;
  function applyStatusToRow(row, targetStatus, doc, headerStatusMap, calibration) {
    const calibratedSelector = calibration?.statusSelectors?.[targetStatus];
    if (calibratedSelector) {
      const calibratedEl = row.querySelector(calibratedSelector);
      if (calibratedEl && applyControlElement(calibratedEl, targetStatus)) {
        return { applied: true };
      }
    }
    let scope = row;
    if (calibration?.targetColumnIndex !== void 0) {
      const cells = getRowCells(row);
      const targetCell = cells[calibration.targetColumnIndex];
      if (!targetCell) {
        return {
          applied: false,
          reason: `Target column ${calibration.targetColumnIndex} not found`
        };
      }
      scope = targetCell;
    }
    const radios = Array.from(
      scope.querySelectorAll("input[type='radio']")
    );
    if (radios.length > 0 && applyRadioHeuristic(radios, targetStatus, doc, row, headerStatusMap)) {
      return { applied: true };
    }
    const selects = Array.from(
      scope.querySelectorAll("select")
    );
    for (const select of selects) {
      if (applySelectHeuristic(select, targetStatus)) {
        return { applied: true };
      }
    }
    const checkboxes = Array.from(
      scope.querySelectorAll("input[type='checkbox']")
    );
    if (checkboxes.length > 0 && applyCheckboxHeuristic(checkboxes, targetStatus, doc, row, headerStatusMap)) {
      return { applied: true };
    }
    const buttons = Array.from(scope.querySelectorAll("button, [role='button']"));
    if (buttons.length > 0 && applyButtonHeuristic(buttons, targetStatus, doc, row, headerStatusMap)) {
      return { applied: true };
    }
    return { applied: false, reason: "No matching attendance control found" };
  }
  function highlightRow(row, matchedBy, applied) {
    const htmlRow = row;
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
  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  async function injectAttendanceRows(doc, students, options = {}) {
    const delayMs = options.dryRun ? 0 : options.delayMs ?? DEFAULT_DELAY_MS;
    const rows = Array.from(doc.querySelectorAll("tr, [role='row']"));
    const headerStatusMap = detectHeaderStatusColumns(doc);
    const alreadyMatched = /* @__PURE__ */ new Set();
    const results = [];
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
          reason: "Student row not found"
        });
      } else {
        alreadyMatched.add(match.row);
        const outcome = options.dryRun ? { applied: false, reason: "Dry-run preview (no input changed)" } : applyStatusToRow(
          match.row,
          student.status,
          doc,
          headerStatusMap,
          options.calibration
        );
        highlightRow(
          match.row,
          match.matchedBy,
          options.dryRun ? true : outcome.applied
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
          reason: outcome.reason
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
      results
    };
  }

  // src/content.ts
  var CALIBRATION_STORAGE_PREFIX = "starstask_calibration:";
  var activeCalibrationCleanup = null;
  function getCalibrationKey(origin) {
    return `${CALIBRATION_STORAGE_PREFIX}${origin}`;
  }
  function isCalibrationProfile(value) {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const record = value;
    return typeof record.origin === "string" && typeof record.updatedAt === "string";
  }
  async function loadCalibrationProfile(origin) {
    const key = getCalibrationKey(origin);
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const result = await chrome.storage.local.get(key);
        const stored = result[key];
        if (isCalibrationProfile(stored)) {
          return stored;
        }
      }
    } catch {
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return void 0;
      }
      const parsed = JSON.parse(raw);
      return isCalibrationProfile(parsed) ? parsed : void 0;
    } catch {
      return void 0;
    }
  }
  async function saveCalibrationProfile(profile) {
    const key = getCalibrationKey(profile.origin);
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: profile });
      }
    } catch {
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(profile));
    } catch {
    }
  }
  async function clearCalibrationProfile(origin) {
    const key = getCalibrationKey(origin);
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.remove(key);
      }
    } catch {
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
    }
  }
  function notifyPopup(message) {
    try {
      void chrome.runtime.sendMessage(message).catch(() => {
      });
    } catch {
    }
  }
  function shouldHandleInCurrentFrame() {
    const hasControls = document.querySelectorAll("input, select, button").length > 0;
    if (window !== window.top) {
      return hasControls && document.querySelectorAll("tr, li, div").length > 0;
    }
    const hasChildFrames = document.querySelectorAll("iframe, frame").length > 0;
    if (hasChildFrames && !hasControls) {
      return false;
    }
    return true;
  }
  function isTabMessageRequest(message) {
    if (typeof message !== "object" || message === null) {
      return false;
    }
    const record = message;
    return typeof record.type === "string";
  }
  async function handleInjectAttendance(request) {
    try {
      const calibration = await loadCalibrationProfile(window.location.origin);
      const summary = await injectAttendanceRows(document, request.students, {
        calibration,
        delayMs: request.delayMs,
        dryRun: request.dryRun,
        onProgress: (done, total) => {
          notifyPopup({ type: "INJECTION_PROGRESS", done, total });
        }
      });
      return { ok: true, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to inject attendance.";
      return { ok: false, error: message };
    }
  }
  function handleStartCalibration() {
    if (activeCalibrationCleanup) {
      activeCalibrationCleanup();
      activeCalibrationCleanup = null;
    }
    try {
      activeCalibrationCleanup = startCalibrationSession(
        document,
        (profile) => {
          const normalizedProfile = {
            ...profile,
            origin: window.location.origin
          };
          activeCalibrationCleanup = null;
          void saveCalibrationProfile(normalizedProfile).then(() => {
            notifyPopup({
              type: "CALIBRATION_COMPLETE",
              profile: normalizedProfile
            });
          });
        },
        (stepPrompt) => {
          notifyPopup({ type: "CALIBRATION_STEP", stepPrompt });
        }
      );
      return { ok: true, started: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start calibration.";
      return { ok: false, error: message };
    }
  }
  function handleCancelCalibration() {
    if (activeCalibrationCleanup) {
      activeCalibrationCleanup();
      activeCalibrationCleanup = null;
    }
    return { ok: true };
  }
  async function handleGetPageStatus() {
    const origin = window.location.origin;
    const profile = await loadCalibrationProfile(origin);
    return {
      ok: true,
      origin,
      hasCalibration: Boolean(profile),
      calibrationUpdatedAt: profile?.updatedAt
    };
  }
  async function handleClearCalibration() {
    await clearCalibrationProfile(window.location.origin);
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isTabMessageRequest(message)) {
      return false;
    }
    if (message.type === "CANCEL_CALIBRATION") {
      sendResponse(handleCancelCalibration());
      return false;
    }
    if (message.type === "CLEAR_CALIBRATION") {
      void handleClearCalibration().then(sendResponse);
      return true;
    }
    if (!shouldHandleInCurrentFrame()) {
      return false;
    }
    switch (message.type) {
      case "INJECT_ATTENDANCE":
        void handleInjectAttendance(message).then(sendResponse);
        return true;
      case "START_CALIBRATION":
        sendResponse(handleStartCalibration());
        return false;
      case "GET_PAGE_STATUS":
        void handleGetPageStatus().then(sendResponse);
        return true;
      default:
        return false;
    }
  });
})();
