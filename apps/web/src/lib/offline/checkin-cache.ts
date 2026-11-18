import { getCacheStore, LAST_VIEW_KEY } from "./db";
import type { OfflineCheckInStateSlot, OfflineCheckInView } from "./types";

type CachedViewRecord = OfflineCheckInView & {
  key: string;
  savedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentity(value: unknown): value is OfflineCheckInView["identity"] {
  if (!isRecord(value)) {
    return false;
  }

  const fullName = value.fullName;
  const nim = value.nim;

  return (
    (typeof fullName === "string" || fullName === null) &&
    (typeof nim === "string" || nim === null)
  );
}

const CHECK_IN_STATUSES = new Set([
  "present",
  "late",
  "excused",
  "sick",
  "absent",
]);

function isCheckInStateSlot(value: unknown): value is OfflineCheckInStateSlot {
  if (value === null) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.status !== "string" ||
    !CHECK_IN_STATUSES.has(value.status)
  ) {
    return false;
  }

  if (typeof value.checkedInAt !== "string") {
    return false;
  }

  const distance = value.distanceM;

  return distance === null || typeof distance === "number";
}

function isCheckInState(
  value: unknown,
): value is OfflineCheckInView["checkInState"] {
  if (!isRecord(value)) {
    return false;
  }

  const meetings = value.meetings;
  const sessions = value.sessions;

  if (!isRecord(meetings) || !isRecord(sessions)) {
    return false;
  }

  for (const slot of Object.values(meetings)) {
    if (!isCheckInStateSlot(slot)) {
      return false;
    }
  }

  for (const slot of Object.values(sessions)) {
    if (!isCheckInStateSlot(slot)) {
      return false;
    }
  }

  return true;
}

function isViewRecord(value: unknown): value is CachedViewRecord {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.key !== "string" || typeof value.savedAt !== "number") {
    return false;
  }

  if (!Array.isArray(value.meetings) || !Array.isArray(value.activeSessions)) {
    return false;
  }

  if (!isIdentity(value.identity)) {
    return false;
  }

  return isCheckInState(value.checkInState);
}

/**
 * Persists the last payload the attendance pages rendered.
 *
 * The cache holds exactly the data the user already saw on this device. It
 * fails silently into a no-op: a full or blocked store must never break the
 * UI path that called it.
 */
export async function saveLastView(view: OfflineCheckInView): Promise<void> {
  const record: CachedViewRecord = {
    key: LAST_VIEW_KEY,
    savedAt: Date.now(),
    meetings: view.meetings,
    identity: view.identity,
    activeSessions: view.activeSessions,
    checkInState: view.checkInState,
  };

  try {
    await getCacheStore("readwrite", async (store) => {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(request.error ?? new Error("Could not save the cached view"));
        };
      });
    });
  } catch (error) {
    console.error("[offline] could not save the cached view", {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
}

export async function readLastView(): Promise<OfflineCheckInView | null> {
  try {
    return await getCacheStore("readonly", async (store) => {
      const raw = await new Promise<unknown>((resolve, reject) => {
        const request = store.get(LAST_VIEW_KEY);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          reject(request.error ?? new Error("Could not read the cached view"));
        };
      });

      if (!isViewRecord(raw)) {
        return null;
      }

      return {
        meetings: raw.meetings,
        identity: raw.identity,
        activeSessions: raw.activeSessions,
        checkInState: raw.checkInState,
      };
    });
  } catch (error) {
    console.error("[offline] could not read the cached view", {
      name: error instanceof Error ? error.name : typeof error,
    });

    return null;
  }
}

export async function clearLastView(): Promise<void> {
  try {
    await getCacheStore("readwrite", async (store) => {
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(LAST_VIEW_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(request.error ?? new Error("Could not clear the cached view"));
        };
      });
    });
  } catch (error) {
    console.error("[offline] could not clear the cached view", {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
}
