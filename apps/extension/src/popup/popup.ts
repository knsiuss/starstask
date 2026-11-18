import type { SyncSessionPayload, SyncStudentRecord } from "../core/types";
import type {
  ClearCalibrationResponse,
  ContentToPopupMessage,
  ExchangeSyncCodeResponse,
  GetPageStatusResponse,
  InjectAttendanceResponse,
  StartCalibrationResponse,
  TabMessageRequest,
} from "./messages";
import {
  clearError,
  getPopupElements,
  renderRoster,
  renderSummary,
  setCalibratingBanner,
  setCalibrationStatus,
  showError,
  updateProgress,
} from "./view";

const DEFAULT_BASE_URL = "http://localhost:3000";
const BASE_URL_STORAGE_KEY = "starstask_base_url";
const ACTIVE_SESSION_STORAGE_KEY = "starstask_active_session";

type StoredSessionState = {
  session: SyncSessionPayload;
  remaining: SyncStudentRecord[];
};

const els = getPopupElements();

let currentSession: SyncSessionPayload | null = null;
let remainingStudents: SyncStudentRecord[] = [];
let isCalibrating = false;
let isInjecting = false;

function getInjectButtonLabel(): string {
  if (els.dryRunCheckbox.checked) {
    return remainingStudents.length > 0 &&
      currentSession &&
      remainingStudents.length < currentSession.students.length
      ? `Preview Remaining (${remainingStudents.length})`
      : "Preview Highlights";
  }

  if (
    currentSession &&
    remainingStudents.length > 0 &&
    remainingStudents.length < currentSession.students.length
  ) {
    return `Inject Remaining (${remainingStudents.length})`;
  }

  return "Inject Attendance Now";
}

function syncInjectButton(): void {
  els.injectBtn.textContent = getInjectButtonLabel();
  els.injectBtn.disabled = remainingStudents.length === 0 || isInjecting;
}

async function saveSessionState(state: StoredSessionState): Promise<void> {
  try {
    await chrome.storage.local.set({ [ACTIVE_SESSION_STORAGE_KEY]: state });
  } catch {
    // Ignore storage errors when running outside extension context.
  }
}

async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  return typeof activeTab?.id === "number" ? activeTab.id : null;
}

async function sendToActiveTab<TResponse>(
  message: TabMessageRequest,
): Promise<TResponse> {
  const tabId = await getActiveTabId();

  if (tabId === null) {
    throw new Error("No active browser tab found.");
  }

  return (await chrome.tabs.sendMessage(tabId, message)) as TResponse;
}

async function loadInitialState(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([
      BASE_URL_STORAGE_KEY,
      ACTIVE_SESSION_STORAGE_KEY,
    ]);
    const savedUrl = stored[BASE_URL_STORAGE_KEY];

    els.baseUrlInput.value =
      typeof savedUrl === "string" && savedUrl.trim().length > 0
        ? savedUrl
        : DEFAULT_BASE_URL;

    const savedState = stored[ACTIVE_SESSION_STORAGE_KEY] as
      StoredSessionState | undefined;
    if (savedState?.session && Array.isArray(savedState.remaining)) {
      const expiresAtMs = Date.parse(savedState.session.expiresAt);
      if (Number.isNaN(expiresAtMs) || expiresAtMs > Date.now()) {
        currentSession = savedState.session;
        remainingStudents = savedState.remaining;
        renderRoster(
          els,
          currentSession,
          isInjecting,
          remainingStudents.length,
        );
        syncInjectButton();
      }
    }
  } catch {
    els.baseUrlInput.value = DEFAULT_BASE_URL;
  }

  try {
    const status = await sendToActiveTab<GetPageStatusResponse>({
      type: "GET_PAGE_STATUS",
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

async function handleFetchRoster(): Promise<void> {
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
    await chrome.storage.local
      .set({ [BASE_URL_STORAGE_KEY]: baseUrl })
      .catch(() => {});

    const response = (await chrome.runtime.sendMessage({
      type: "EXCHANGE_SYNC_CODE",
      baseUrl,
      code,
    })) as ExchangeSyncCodeResponse;

    if (!response?.ok) {
      showError(els, response?.error ?? "Failed to exchange sync code.");
      return;
    }

    currentSession = response.payload;
    remainingStudents = [...response.payload.students];
    await saveSessionState({
      session: currentSession,
      remaining: remainingStudents,
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

async function handleToggleCalibration(): Promise<void> {
  clearError(els);

  if (isCalibrating) {
    try {
      await sendToActiveTab({ type: "CANCEL_CALIBRATION" });
    } catch {
      // Ignore if tab is no longer reachable.
    }

    isCalibrating = false;
    setCalibratingBanner(els, false);
    return;
  }

  try {
    const response = await sendToActiveTab<StartCalibrationResponse>({
      type: "START_CALIBRATION",
    });

    if (!response?.ok) {
      showError(
        els,
        response?.error ?? "Unable to start calibration on this tab.",
      );
      return;
    }

    isCalibrating = true;
    setCalibratingBanner(
      els,
      true,
      "Click a sample status control on the SIAKAD page to calibrate.",
    );
  } catch {
    showError(els, "Reload the SIAKAD tab first, then try calibrating again.");
  }
}

async function handleClearCalibration(): Promise<void> {
  clearError(els);

  try {
    const response = await sendToActiveTab<ClearCalibrationResponse>({
      type: "CLEAR_CALIBRATION",
    });

    if (response?.ok) {
      setCalibrationStatus(els, false);
    }
  } catch {
    showError(els, "Unable to reset calibration on this tab.");
  }
}

async function handleInjectAttendance(): Promise<void> {
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
    const response = await sendToActiveTab<InjectAttendanceResponse>({
      type: "INJECT_ATTENDANCE",
      students: targetStudents,
      dryRun,
    });

    if (!response?.ok) {
      showError(els, response?.error ?? "Attendance injection failed.");
      return;
    }

    updateProgress(els, targetStudents.length, targetStudents.length);
    renderSummary(els, response.summary);

    if (!dryRun) {
      remainingStudents = response.summary.results
        .filter((item) => item.matchedBy === "unmatched")
        .map((item) => item.student);

      await saveSessionState({
        session: currentSession,
        remaining: remainingStudents,
      });
      renderRoster(els, currentSession, isInjecting, remainingStudents.length);
    }
  } catch {
    showError(
      els,
      "Could not reach the SIAKAD page. Reload the tab and try again.",
    );
  } finally {
    isInjecting = false;
    syncInjectButton();
  }
}

function isContentToPopupMessage(
  message: unknown,
): message is ContentToPopupMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const record = message as Record<string, unknown>;

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
