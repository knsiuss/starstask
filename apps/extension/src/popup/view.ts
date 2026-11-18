import type { InjectionSummary, SyncSessionPayload } from "../core/types";

export type PopupElements = {
  baseUrlInput: HTMLInputElement;
  syncCodeInput: HTMLInputElement;
  fetchBtn: HTMLButtonElement;
  calibrateBtn: HTMLButtonElement;
  clearCalibrationBtn: HTMLButtonElement;
  dryRunCheckbox: HTMLInputElement;
  injectBtn: HTMLButtonElement;
  calibrationBadge: HTMLSpanElement;
  originLabel: HTMLParagraphElement;
  calibrationPrompt: HTMLDivElement;
  rosterCard: HTMLDivElement;
  rosterClass: HTMLSpanElement;
  rosterCount: HTMLSpanElement;
  rosterMeeting: HTMLParagraphElement;
  rosterExpiry: HTMLParagraphElement;
  progressWrapper: HTMLDivElement;
  progressText: HTMLSpanElement;
  progressBarRole: HTMLDivElement;
  progressFill: HTMLDivElement;
  errorBanner: HTMLDivElement;
  summarySection: HTMLElement;
  statNim: HTMLSpanElement;
  statFallback: HTMLSpanElement;
  statUnmatched: HTMLSpanElement;
  reviewList: HTMLUListElement;
};

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);

  if (!el) {
    throw new Error(`Missing required popup element: ${id}`);
  }

  return el as T;
}

export function getPopupElements(): PopupElements {
  return {
    baseUrlInput: requireElement<HTMLInputElement>("base-url-input"),
    syncCodeInput: requireElement<HTMLInputElement>("sync-code-input"),
    fetchBtn: requireElement<HTMLButtonElement>("fetch-btn"),
    calibrateBtn: requireElement<HTMLButtonElement>("calibrate-btn"),
    clearCalibrationBtn: requireElement<HTMLButtonElement>(
      "clear-calibration-btn",
    ),
    dryRunCheckbox: requireElement<HTMLInputElement>("dry-run-checkbox"),
    injectBtn: requireElement<HTMLButtonElement>("inject-btn"),
    calibrationBadge: requireElement<HTMLSpanElement>("calibration-badge"),
    originLabel: requireElement<HTMLParagraphElement>("origin-label"),
    calibrationPrompt: requireElement<HTMLDivElement>("calibration-prompt"),
    rosterCard: requireElement<HTMLDivElement>("roster-card"),
    rosterClass: requireElement<HTMLSpanElement>("roster-class"),
    rosterCount: requireElement<HTMLSpanElement>("roster-count"),
    rosterMeeting: requireElement<HTMLParagraphElement>("roster-meeting"),
    rosterExpiry: requireElement<HTMLParagraphElement>("roster-expiry"),
    progressWrapper: requireElement<HTMLDivElement>("progress-wrapper"),
    progressText: requireElement<HTMLSpanElement>("progress-text"),
    progressBarRole: requireElement<HTMLDivElement>("progress-bar-role"),
    progressFill: requireElement<HTMLDivElement>("progress-fill"),
    errorBanner: requireElement<HTMLDivElement>("error-banner"),
    summarySection: requireElement<HTMLElement>("summary-section"),
    statNim: requireElement<HTMLSpanElement>("stat-nim"),
    statFallback: requireElement<HTMLSpanElement>("stat-fallback"),
    statUnmatched: requireElement<HTMLSpanElement>("stat-unmatched"),
    reviewList: requireElement<HTMLUListElement>("review-list"),
  };
}

export function showError(els: PopupElements, message: string): void {
  els.errorBanner.textContent = message;
  els.errorBanner.classList.remove("hidden");
}

export function clearError(els: PopupElements): void {
  els.errorBanner.textContent = "";
  els.errorBanner.classList.add("hidden");
}

export function setCalibrationStatus(
  els: PopupElements,
  calibrated: boolean,
): void {
  if (calibrated) {
    els.calibrationBadge.textContent = "Calibrated";
    els.calibrationBadge.classList.remove("status-pill-muted");
    els.calibrationBadge.classList.add("status-pill-active");
    els.clearCalibrationBtn.classList.remove("hidden");
  } else {
    els.calibrationBadge.textContent = "Not calibrated";
    els.calibrationBadge.classList.remove("status-pill-active");
    els.calibrationBadge.classList.add("status-pill-muted");
    els.clearCalibrationBtn.classList.add("hidden");
  }
}

export function setCalibratingBanner(
  els: PopupElements,
  active: boolean,
  promptText?: string,
): void {
  els.calibrateBtn.textContent = active
    ? "Cancel Calibration"
    : "Calibrate This Page";

  if (active && promptText) {
    els.calibrationPrompt.textContent = promptText;
    els.calibrationPrompt.classList.remove("hidden");
  } else if (!active) {
    els.calibrationPrompt.textContent = "";
    els.calibrationPrompt.classList.add("hidden");
  }
}

export function updateProgress(
  els: PopupElements,
  done: number,
  total: number,
): void {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(100, Math.round((done / safeTotal) * 100));

  els.progressWrapper.classList.remove("hidden");
  els.progressText.textContent = `${done} / ${total}`;
  els.progressFill.style.width = `${pct}%`;
  els.progressBarRole.setAttribute("aria-valuenow", String(pct));
}

export function renderRoster(
  els: PopupElements,
  session: SyncSessionPayload,
  isInjecting: boolean,
  remainingCount = session.students.length,
): void {
  els.rosterClass.textContent = session.className;
  els.rosterCount.textContent =
    remainingCount < session.students.length
      ? `${remainingCount} / ${session.students.length} remaining`
      : `${session.students.length} students`;
  els.rosterMeeting.textContent = session.meetingTitle;

  const expiresDate = new Date(session.expiresAt);
  const formattedExpiry = Number.isNaN(expiresDate.getTime())
    ? session.expiresAt
    : expiresDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

  els.rosterExpiry.textContent = `Code expires at ${formattedExpiry}`;
  els.rosterCard.classList.remove("hidden");
  els.injectBtn.disabled = remainingCount === 0 || isInjecting;
}

export function renderSummary(
  els: PopupElements,
  summary: InjectionSummary,
): void {
  els.statNim.textContent = String(summary.matchedByNim);
  els.statFallback.textContent = String(summary.matchedByNameFallback);
  els.statUnmatched.textContent = String(summary.unmatched);
  els.summarySection.classList.remove("hidden");

  els.reviewList.replaceChildren();
  const flagged = summary.results.filter(
    (item) => item.matchedBy !== "nim" || !item.applied,
  );

  if (flagged.length === 0) {
    els.reviewList.classList.add("hidden");
    return;
  }

  for (const item of flagged) {
    const li = document.createElement("li");
    li.className = "review-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "review-name";
    nameSpan.textContent = item.student.nim
      ? `${item.student.displayName} (${item.student.nim})`
      : item.student.displayName;

    const tagSpan = document.createElement("span");
    const isNameFallback = item.matchedBy === "name-fallback";
    tagSpan.className = isNameFallback
      ? "review-tag review-tag-yellow"
      : "review-tag review-tag-red";
    tagSpan.textContent = isNameFallback
      ? item.applied
        ? "Name fallback"
        : item.reason || "Name fallback"
      : item.reason || "Unmatched";

    li.append(nameSpan, tagSpan);
    els.reviewList.appendChild(li);
  }

  els.reviewList.classList.remove("hidden");
}
