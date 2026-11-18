"use strict";
(() => {
  // src/popup/view.ts
  function requireElement(id) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Missing required popup element: ${id}`);
    }
    return el;
  }
  function getPopupElements() {
    return {
      baseUrlInput: requireElement("base-url-input"),
      syncCodeInput: requireElement("sync-code-input"),
      fetchBtn: requireElement("fetch-btn"),
      calibrateBtn: requireElement("calibrate-btn"),
      clearCalibrationBtn: requireElement(
        "clear-calibration-btn"
      ),
      dryRunCheckbox: requireElement("dry-run-checkbox"),
      injectBtn: requireElement("inject-btn"),
      calibrationBadge: requireElement("calibration-badge"),
      originLabel: requireElement("origin-label"),
      calibrationPrompt: requireElement("calibration-prompt"),
      rosterCard: requireElement("roster-card"),
      rosterClass: requireElement("roster-class"),
      rosterCount: requireElement("roster-count"),
      rosterMeeting: requireElement("roster-meeting"),
      rosterExpiry: requireElement("roster-expiry"),
      progressWrapper: requireElement("progress-wrapper"),
      progressText: requireElement("progress-text"),
      progressBarRole: requireElement("progress-bar-role"),
      progressFill: requireElement("progress-fill"),
      errorBanner: requireElement("error-banner"),
      summarySection: requireElement("summary-section"),
      statNim: requireElement("stat-nim"),
      statFallback: requireElement("stat-fallback"),
      statUnmatched: requireElement("stat-unmatched"),
      reviewList: requireElement("review-list")
    };
  }
  function showError(els2, message) {
    els2.errorBanner.textContent = message;
    els2.errorBanner.classList.remove("hidden");
  }
  function clearError(els2) {
    els2.errorBanner.textContent = "";
    els2.errorBanner.classList.add("hidden");
  }
  function setCalibrationStatus(els2, calibrated) {
    if (calibrated) {
      els2.calibrationBadge.textContent = "Calibrated";
      els2.calibrationBadge.classList.remove("status-pill-muted");
      els2.calibrationBadge.classList.add("status-pill-active");
      els2.clearCalibrationBtn.classList.remove("hidden");
    } else {
      els2.calibrationBadge.textContent = "Not calibrated";
      els2.calibrationBadge.classList.remove("status-pill-active");
      els2.calibrationBadge.classList.add("status-pill-muted");
      els2.clearCalibrationBtn.classList.add("hidden");
    }
  }
  function setCalibratingBanner(els2, active, promptText) {
    els2.calibrateBtn.textContent = active ? "Cancel Calibration" : "Calibrate This Page";
    if (active && promptText) {
      els2.calibrationPrompt.textContent = promptText;
      els2.calibrationPrompt.classList.remove("hidden");
    } else if (!active) {
      els2.calibrationPrompt.textContent = "";
      els2.calibrationPrompt.classList.add("hidden");
    }
  }
  function updateProgress(els2, done, total) {
    const safeTotal = Math.max(total, 1);
    const pct = Math.min(100, Math.round(done / safeTotal * 100));
    els2.progressWrapper.classList.remove("hidden");
    els2.progressText.textContent = `${done} / ${total}`;
    els2.progressFill.style.width = `${pct}%`;
    els2.progressBarRole.setAttribute("aria-valuenow", String(pct));
  }
  function renderRoster(els2, session, isInjecting2, remainingCount = session.students.length) {
    els2.rosterClass.textContent = session.className;
    els2.rosterCount.textContent = remainingCount < session.students.length ? `${remainingCount} / ${session.students.length} remaining` : `${session.students.length} students`;
    els2.rosterMeeting.textContent = session.meetingTitle;
    const expiresDate = new Date(session.expiresAt);
    const formattedExpiry = Number.isNaN(expiresDate.getTime()) ? session.expiresAt : expiresDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    els2.rosterExpiry.textContent = `Code expires at ${formattedExpiry}`;
    els2.rosterCard.classList.remove("hidden");
    els2.injectBtn.disabled = remainingCount === 0 || isInjecting2;
  }
  function renderSummary(els2, summary) {
    els2.statNim.textContent = String(summary.matchedByNim);
    els2.statFallback.textContent = String(summary.matchedByNameFallback);
    els2.statUnmatched.textContent = String(summary.unmatched);
    els2.summarySection.classList.remove("hidden");
    els2.reviewList.replaceChildren();
    const flagged = summary.results.filter(
      (item) => item.matchedBy !== "nim" || !item.applied
    );
    if (flagged.length === 0) {
      els2.reviewList.classList.add("hidden");
      return;
    }
    for (const item of flagged) {
      const li = document.createElement("li");
      li.className = "review-item";
      const nameSpan = document.createElement("span");
      nameSpan.className = "review-name";
      nameSpan.textContent = item.student.nim ? `${item.student.displayName} (${item.student.nim})` : item.student.displayName;
      const tagSpan = document.createElement("span");
      const isNameFallback = item.matchedBy === "name-fallback";
      tagSpan.className = isNameFallback ? "review-tag review-tag-yellow" : "review-tag review-tag-red";
      tagSpan.textContent = isNameFallback ? item.applied ? "Name fallback" : item.reason || "Name fallback" : item.reason || "Unmatched";
      li.append(nameSpan, tagSpan);
      els2.reviewList.appendChild(li);
    }
    els2.reviewList.classList.remove("hidden");
  }

  // src/popup/popup.ts
  var DEFAULT_BASE_URL = "http://localhost:3000";
  var BASE_URL_STORAGE_KEY = "starstask_base_url";
  var ACTIVE_SESSION_STORAGE_KEY = "starstask_active_session";
  var els = getPopupElements();
  var currentSession = null;
  var remainingStudents = [];
  var isCalibrating = false;
  var isInjecting = false;
  function getInjectButtonLabel() {
    if (els.dryRunCheckbox.checked) {
      return remainingStudents.length > 0 && currentSession && remainingStudents.length < currentSession.students.length ? `Preview Remaining (${remainingStudents.length})` : "Preview Highlights";
    }
    if (currentSession && remainingStudents.length > 0 && remainingStudents.length < currentSession.students.length) {
      return `Inject Remaining (${remainingStudents.length})`;
    }
    return "Inject Attendance Now";
  }
  function syncInjectButton() {
    els.injectBtn.textContent = getInjectButtonLabel();
    els.injectBtn.disabled = remainingStudents.length === 0 || isInjecting;
  }
  async function saveSessionState(state) {
    try {
      await chrome.storage.local.set({ [ACTIVE_SESSION_STORAGE_KEY]: state });
    } catch {
    }
  }
  async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    return typeof activeTab?.id === "number" ? activeTab.id : null;
  }
  async function sendToActiveTab(message) {
    const tabId = await getActiveTabId();
    if (tabId === null) {
      throw new Error("No active browser tab found.");
    }
    return await chrome.tabs.sendMessage(tabId, message);
  }
  async function loadInitialState() {
    try {
      const stored = await chrome.storage.local.get([
        BASE_URL_STORAGE_KEY,
        ACTIVE_SESSION_STORAGE_KEY
      ]);
      const savedUrl = stored[BASE_URL_STORAGE_KEY];
      els.baseUrlInput.value = typeof savedUrl === "string" && savedUrl.trim().length > 0 ? savedUrl : DEFAULT_BASE_URL;
      const savedState = stored[ACTIVE_SESSION_STORAGE_KEY];
      if (savedState?.session && Array.isArray(savedState.remaining)) {
        const expiresAtMs = Date.parse(savedState.session.expiresAt);
        if (Number.isNaN(expiresAtMs) || expiresAtMs > Date.now()) {
          currentSession = savedState.session;
          remainingStudents = savedState.remaining;
          renderRoster(
            els,
            currentSession,
            isInjecting,
            remainingStudents.length
          );
          syncInjectButton();
        }
      }
    } catch {
      els.baseUrlInput.value = DEFAULT_BASE_URL;
    }
    try {
      const status = await sendToActiveTab({
        type: "GET_PAGE_STATUS"
      });
      if (status?.ok) {
        els.originLabel.textContent = `Active tab: ${status.origin}`;
        setCalibrationStatus(els, status.hasCalibration);
      } else {
        els.originLabel.textContent = "Active tab: SIAKAD page not detected";
        setCalibrationStatus(els, false);
      }
    } catch {
      els.originLabel.textContent = "Active tab: reload page to enable injector";
      setCalibrationStatus(els, false);
    }
  }
  async function handleFetchRoster() {
    clearError(els);
    const baseUrl = els.baseUrlInput.value.trim() || DEFAULT_BASE_URL;
    const code = els.syncCodeInput.value.trim();
    if (!code) {
      showError(els, "Please enter a sync code from StarsTask.");
      els.syncCodeInput.focus();
      return;
    }
    els.fetchBtn.disabled = true;
    els.fetchBtn.textContent = "Fetching...";
    try {
      await chrome.storage.local.set({ [BASE_URL_STORAGE_KEY]: baseUrl }).catch(() => {
      });
      const response = await chrome.runtime.sendMessage({
        type: "EXCHANGE_SYNC_CODE",
        baseUrl,
        code
      });
      if (!response?.ok) {
        showError(els, response?.error ?? "Failed to exchange sync code.");
        return;
      }
      currentSession = response.payload;
      remainingStudents = [...response.payload.students];
      await saveSessionState({
        session: currentSession,
        remaining: remainingStudents
      });
      renderRoster(els, currentSession, isInjecting, remainingStudents.length);
      syncInjectButton();
      els.summarySection.classList.add("hidden");
    } catch {
      showError(els, "Unable to communicate with extension background service.");
    } finally {
      els.fetchBtn.disabled = false;
      els.fetchBtn.textContent = "Fetch Roster";
    }
  }
  async function handleToggleCalibration() {
    clearError(els);
    if (isCalibrating) {
      try {
        await sendToActiveTab({ type: "CANCEL_CALIBRATION" });
      } catch {
      }
      isCalibrating = false;
      setCalibratingBanner(els, false);
      return;
    }
    try {
      const response = await sendToActiveTab({
        type: "START_CALIBRATION"
      });
      if (!response?.ok) {
        showError(
          els,
          response?.error ?? "Unable to start calibration on this tab."
        );
        return;
      }
      isCalibrating = true;
      setCalibratingBanner(
        els,
        true,
        "Click a sample status control on the SIAKAD page to calibrate."
      );
    } catch {
      showError(els, "Reload the SIAKAD tab first, then try calibrating again.");
    }
  }
  async function handleClearCalibration() {
    clearError(els);
    try {
      const response = await sendToActiveTab({
        type: "CLEAR_CALIBRATION"
      });
      if (response?.ok) {
        setCalibrationStatus(els, false);
      }
    } catch {
      showError(els, "Unable to reset calibration on this tab.");
    }
  }
  async function handleInjectAttendance() {
    if (!currentSession || remainingStudents.length === 0 || isInjecting) {
      return;
    }
    const dryRun = els.dryRunCheckbox.checked;
    const targetStudents = remainingStudents;
    clearError(els);
    isInjecting = true;
    els.injectBtn.disabled = true;
    els.injectBtn.textContent = dryRun ? "Previewing..." : "Injecting...";
    els.summarySection.classList.add("hidden");
    updateProgress(els, 0, targetStudents.length);
    try {
      const response = await sendToActiveTab({
        type: "INJECT_ATTENDANCE",
        students: targetStudents,
        dryRun
      });
      if (!response?.ok) {
        showError(els, response?.error ?? "Attendance injection failed.");
        return;
      }
      updateProgress(els, targetStudents.length, targetStudents.length);
      renderSummary(els, response.summary);
      if (!dryRun) {
        remainingStudents = response.summary.results.filter((item) => item.matchedBy === "unmatched").map((item) => item.student);
        await saveSessionState({
          session: currentSession,
          remaining: remainingStudents
        });
        renderRoster(els, currentSession, isInjecting, remainingStudents.length);
      }
    } catch {
      showError(
        els,
        "Could not reach the SIAKAD page. Reload the tab and try again."
      );
    } finally {
      isInjecting = false;
      syncInjectButton();
    }
  }
  function isContentToPopupMessage(message) {
    if (typeof message !== "object" || message === null) {
      return false;
    }
    const record = message;
    return typeof record.type === "string";
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (!isContentToPopupMessage(message)) {
      return false;
    }
    if (message.type === "INJECTION_PROGRESS") {
      updateProgress(els, message.done, message.total);
    } else if (message.type === "CALIBRATION_STEP") {
      isCalibrating = true;
      setCalibratingBanner(els, true, message.stepPrompt);
    } else if (message.type === "CALIBRATION_COMPLETE") {
      isCalibrating = false;
      setCalibratingBanner(els, false);
      setCalibrationStatus(els, true);
    }
    return false;
  });
  els.fetchBtn.addEventListener("click", () => {
    void handleFetchRoster();
  });
  els.syncCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleFetchRoster();
    }
  });
  els.calibrateBtn.addEventListener("click", () => {
    void handleToggleCalibration();
  });
  els.clearCalibrationBtn.addEventListener("click", () => {
    void handleClearCalibration();
  });
  els.dryRunCheckbox.addEventListener("change", () => {
    syncInjectButton();
  });
  els.injectBtn.addEventListener("click", () => {
    void handleInjectAttendance();
  });
  void loadInitialState();
})();
