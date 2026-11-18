import { injectAttendanceRows, startCalibrationSession } from "./core/index";
import type { CalibrationProfile } from "./core/types";
import type {
  CancelCalibrationResponse,
  ClearCalibrationResponse,
  ContentToPopupMessage,
  GetPageStatusResponse,
  InjectAttendanceRequest,
  InjectAttendanceResponse,
  StartCalibrationResponse,
  TabMessageRequest,
} from "./popup/messages";

const CALIBRATION_STORAGE_PREFIX = "starstask_calibration:";

let activeCalibrationCleanup: (() => void) | null = null;

function getCalibrationKey(origin: string): string {
  return `${CALIBRATION_STORAGE_PREFIX}${origin}`;
}

function isCalibrationProfile(value: unknown): value is CalibrationProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.origin === "string" && typeof record.updatedAt === "string"
  );
}

async function loadCalibrationProfile(
  origin: string,
): Promise<CalibrationProfile | undefined> {
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
    // Fall back to localStorage when extension storage is unavailable.
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return undefined;
    }

    const parsed: unknown = JSON.parse(raw);

    return isCalibrationProfile(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function saveCalibrationProfile(
  profile: CalibrationProfile,
): Promise<void> {
  const key = getCalibrationKey(profile.origin);

  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [key]: profile });
    }
  } catch {
    // Continue to localStorage fallback.
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(profile));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

async function clearCalibrationProfile(origin: string): Promise<void> {
  const key = getCalibrationKey(origin);

  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.remove(key);
    }
  } catch {
    // Continue to localStorage cleanup.
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

function notifyPopup(message: ContentToPopupMessage): void {
  try {
    void chrome.runtime.sendMessage(message).catch(() => {
      // Popup may be closed while injection or calibration runs.
    });
  } catch {
    // Ignore disconnected runtime errors.
  }
}

function shouldHandleInCurrentFrame(): boolean {
  const hasControls =
    document.querySelectorAll("input, select, button").length > 0;

  if (window !== window.top) {
    return hasControls && document.querySelectorAll("tr, li, div").length > 0;
  }

  const hasChildFrames = document.querySelectorAll("iframe, frame").length > 0;

  if (hasChildFrames && !hasControls) {
    return false;
  }

  return true;
}

function isTabMessageRequest(message: unknown): message is TabMessageRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const record = message as Record<string, unknown>;

  return typeof record.type === "string";
}

async function handleInjectAttendance(
  request: InjectAttendanceRequest,
): Promise<InjectAttendanceResponse> {
  try {
    const calibration = await loadCalibrationProfile(window.location.origin);
    const summary = await injectAttendanceRows(document, request.students, {
      calibration,
      delayMs: request.delayMs,
      dryRun: request.dryRun,
      onProgress: (done, total) => {
        notifyPopup({ type: "INJECTION_PROGRESS", done, total });
      },
    });

    return { ok: true, summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to inject attendance.";

    return { ok: false, error: message };
  }
}

function handleStartCalibration(): StartCalibrationResponse {
  if (activeCalibrationCleanup) {
    activeCalibrationCleanup();
    activeCalibrationCleanup = null;
  }

  try {
    activeCalibrationCleanup = startCalibrationSession(
      document,
      (profile) => {
        const normalizedProfile: CalibrationProfile = {
          ...profile,
          origin: window.location.origin,
        };

        activeCalibrationCleanup = null;
        void saveCalibrationProfile(normalizedProfile).then(() => {
          notifyPopup({
            type: "CALIBRATION_COMPLETE",
            profile: normalizedProfile,
          });
        });
      },
      (stepPrompt) => {
        notifyPopup({ type: "CALIBRATION_STEP", stepPrompt });
      },
    );

    return { ok: true, started: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start calibration.";

    return { ok: false, error: message };
  }
}

function handleCancelCalibration(): CancelCalibrationResponse {
  if (activeCalibrationCleanup) {
    activeCalibrationCleanup();
    activeCalibrationCleanup = null;
  }

  return { ok: true };
}

async function handleGetPageStatus(): Promise<GetPageStatusResponse> {
  const origin = window.location.origin;
  const profile = await loadCalibrationProfile(origin);

  return {
    ok: true,
    origin,
    hasCalibration: Boolean(profile),
    calibrationUpdatedAt: profile?.updatedAt,
  };
}

async function handleClearCalibration(): Promise<ClearCalibrationResponse> {
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
