import { clearOfflineStores, getOutboxStore, requestToPromise } from "./db";
import type {
  CheckinOutboxBody,
  CheckinOutboxEntry,
  CheckinOutboxKind,
  FlushEntryOutcome,
  FlushResult,
} from "./types";
import type { AttendanceCheckInStatus } from "@/lib/attendance/types";

/**
 * Outbox for offline check-in taps.
 *
 * Replay always omits `capturedAt` (locked decision L1): the server owns the
 * window and lateness decision with its own clock. `capturedAt` stays inside
 * the record as audit metadata only.
 *
 * Transient entries use an `attempts`-based backoff: an entry that already
 * failed once is skipped until `createdAt + attempts * 30_000 <= now`. A
 * failure means the network dropped mid-flight, so hammering the same endpoint
 * every foreground flush would only amplify a weak signal. Terminal rejections
 * never get here — they are marked `failed` and wait for a human.
 */
const ENDPOINT_BY_KIND: Record<CheckinOutboxKind, string> = {
  "attendance-meeting": "/api/attendance/meetings/[id]/checkin",
  session: "/api/sessions/[id]/checkin",
};

const BACKOFF_STEP_MS = 30_000;
const BACKOFF_CAP_MS = 10 * 60_000;
// A replay POST is short-lived; anything still "syncing" after this long
// means the tab died mid-flight rather than an HTTP request in progress.
const SYNCING_STALE_MS = 5 * 60_000;

const TERMINAL_CODES = new Set([
  "checkin_closed",
  "checkin_unavailable",
  "checkin_identity_missing",
  "checkin_name_mismatch",
  "checkin_nim_mismatch",
  "checkin_too_far",
  "checkin_imprecise",
  "checkin_not_open",
  "checkin_not_scheduled",
  "checkin_stale_position",
  "validation_error",
]);

const ATTENDANCE_CHECKIN_STATUSES = new Set<AttendanceCheckInStatus>([
  "present",
  "late",
  "excused",
  "sick",
  "absent",
]);

function isKind(value: unknown): value is CheckinOutboxKind {
  return value === "attendance-meeting" || value === "session";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAttendanceCheckInStatus(
  value: unknown,
): value is AttendanceCheckInStatus {
  return (
    typeof value === "string" &&
    ATTENDANCE_CHECKIN_STATUSES.has(value as AttendanceCheckInStatus)
  );
}

function buildEndpoint(kind: CheckinOutboxKind, sessionId: string): string {
  const template = ENDPOINT_BY_KIND[kind];
  const trimmedId = sessionId.trim();

  if (!trimmedId) {
    throw new Error("sessionId is required to build the check-in endpoint");
  }

  return template.replace("[id]", encodeURIComponent(trimmedId));
}

function buildReplayBody(entry: CheckinOutboxEntry): Record<string, unknown> {
  const { body, kind } = entry;

  if (kind === "attendance-meeting") {
    return {
      fullName: body.fullName,
      nim: body.nim,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy,
    };
  }

  return {
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy,
  };
}

function backoffDeadline(entry: CheckinOutboxEntry): number {
  const delay = Math.min(entry.attempts * BACKOFF_STEP_MS, BACKOFF_CAP_MS);

  return entry.createdAt + delay;
}

function isClaimable(entry: CheckinOutboxEntry, now: number): boolean {
  if (entry.status === "pending_sync") {
    return true;
  }

  return (
    entry.status === "syncing" &&
    entry.syncingAt !== undefined &&
    entry.syncingAt + SYNCING_STALE_MS <= now
  );
}

async function readAllEntries(): Promise<CheckinOutboxEntry[]> {
  return getOutboxStore("readonly", async (store) => {
    const raw = await requestToPromise(store.getAll());

    return raw.filter((item): item is CheckinOutboxEntry =>
      isOutboxEntry(item),
    );
  });
}

function isOutboxEntry(value: unknown): value is CheckinOutboxEntry {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== "string" || !isKind(value.kind)) {
    return false;
  }

  if (
    typeof value.endpoint !== "string" ||
    typeof value.sessionId !== "string"
  ) {
    return false;
  }

  if (!isRecord(value.body)) {
    return false;
  }

  const body = value.body;

  if (
    typeof body.latitude !== "number" ||
    typeof body.longitude !== "number" ||
    typeof body.accuracy !== "number"
  ) {
    return false;
  }

  if (
    typeof value.capturedAt !== "number" ||
    typeof value.createdAt !== "number"
  ) {
    return false;
  }

  if (typeof value.attempts !== "number") {
    return false;
  }

  const status = value.status;

  return (
    status === "pending_sync" ||
    status === "syncing" ||
    status === "sent" ||
    status === "failed"
  );
}

async function putEntry(entry: CheckinOutboxEntry): Promise<void> {
  await getOutboxStore("readwrite", async (store) => {
    await requestToPromise(store.put(entry));
  });
}

const listeners = new Set<(entries: CheckinOutboxEntry[]) => void>();

async function notifyListeners(): Promise<void> {
  if (listeners.size === 0) {
    return;
  }

  const snapshot = await readAllEntries();

  for (const listener of [...listeners]) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("[offline] outbox subscriber threw", {
        name: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}

export async function enqueue(
  kind: CheckinOutboxKind,
  sessionId: string,
  body: CheckinOutboxBody,
): Promise<CheckinOutboxEntry> {
  if (!isKind(kind)) {
    throw new Error(`Unknown check-in kind: ${String(kind)}`);
  }

  if (!sessionId.trim()) {
    throw new Error("sessionId is required to enqueue a check-in");
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  const entry: CheckinOutboxEntry = {
    id,
    kind,
    endpoint: buildEndpoint(kind, sessionId),
    sessionId: sessionId.trim(),
    body: {
      fullName: body.fullName,
      nim: body.nim,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy,
    },
    capturedAt: now,
    status: "pending_sync",
    attempts: 0,
    lastError: null,
    createdAt: now,
  };

  await getOutboxStore("readwrite", async (store) => {
    await requestToPromise(store.add(entry));
  });

  await notifyListeners();

  return entry;
}

export async function list(): Promise<CheckinOutboxEntry[]> {
  const entries = await readAllEntries();

  return entries.sort((left, right) => left.createdAt - right.createdAt);
}

export async function count(): Promise<number> {
  const entries = await readAllEntries();

  // Unresolved entries include in-flight and stale `syncing` ones, so a
  // crashed tap is never invisible to the badge. Cards reconcile the same
  // way.
  return entries.filter(
    (entry) => entry.status === "pending_sync" || entry.status === "syncing",
  ).length;
}

export async function remove(id: string): Promise<void> {
  await getOutboxStore("readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });

  await notifyListeners();
}

export function subscribe(
  listener: (entries: CheckinOutboxEntry[]) => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function clearAll(): Promise<void> {
  await clearOfflineStores();
  await notifyListeners();
}

function pickErrorCode(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const error = payload.error;

  if (!isRecord(error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

function pickSuccessPayload(
  payload: unknown,
): { status: AttendanceCheckInStatus; alreadyCheckedIn: boolean } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const data = payload.data;

  if (!isRecord(data)) {
    return null;
  }

  // Meeting flow returns the result fields directly; the session flow nests
  // them under `data.checkIn`. Both shapes pass through the same replay path.
  const nested = isRecord(data.checkIn) ? data.checkIn : data;
  const status = nested.status;

  if (!isAttendanceCheckInStatus(status)) {
    return null;
  }

  return {
    status,
    alreadyCheckedIn: nested.alreadyCheckedIn === true,
  };
}

type OutboxFetch = (input: string, init: RequestInit) => Promise<Response>;

export async function flush(
  fetchImpl: OutboxFetch = fetch,
): Promise<FlushResult> {
  const now = Date.now();
  const outcomes: FlushEntryOutcome[] = [];
  let sessionExpired = false;

  const snapshot = await list();
  const claimable = snapshot.filter((entry) => isClaimable(entry, now));

  for (const entry of claimable) {
    if (entry.attempts > 0 && backoffDeadline(entry) > now) {
      outcomes.push({ kind: "deferred", id: entry.id });
      continue;
    }

    const claimed = await claimEntry(entry);

    if (!claimed) {
      outcomes.push({ kind: "deferred", id: entry.id });
      continue;
    }

    const outcome = await replayEntry(claimed, fetchImpl);

    outcomes.push(outcome);

    if (outcome.kind === "retry" && outcome.error === "http_401") {
      sessionExpired = true;
    }
  }

  await notifyListeners();

  return {
    outcomes,
    sent: outcomes.filter((outcome) => outcome.kind === "sent").length,
    failed: outcomes.filter((outcome) => outcome.kind === "failed").length,
    deferred: outcomes.filter((outcome) => outcome.kind === "deferred").length,
    retried: outcomes.filter((outcome) => outcome.kind === "retry").length,
    sessionExpired,
  };
}

async function claimEntry(
  entry: CheckinOutboxEntry,
): Promise<CheckinOutboxEntry | null> {
  return getOutboxStore("readwrite", async (store) => {
    const raw = await requestToPromise(store.get(entry.id));

    if (!isOutboxEntry(raw)) {
      return null;
    }

    // Another tab may have claimed or sent this entry since the snapshot was
    // taken; only a still-pending or stale-syncing record may be claimed.
    if (!isClaimable(raw, Date.now())) {
      return null;
    }

    const claimed: CheckinOutboxEntry = {
      ...raw,
      status: "syncing",
      syncingAt: Date.now(),
    };

    await requestToPromise(store.put(claimed));

    return claimed;
  });
}

async function replayEntry(
  entry: CheckinOutboxEntry,
  fetchImpl: OutboxFetch,
): Promise<FlushEntryOutcome> {
  const body = buildReplayBody(entry);

  let response: Response;

  try {
    response = await fetchImpl(entry.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch (error) {
    // Network-layer failure: drop back to pending_sync and let backoff gate
    // the next attempt. A TypeError here is the browser's offline signal.
    const reason = error instanceof Error ? error.name : "network_error";

    await putEntry({
      ...entry,
      status: "pending_sync",
      attempts: entry.attempts + 1,
      lastError: reason,
    });

    return { kind: "retry", id: entry.id, error: reason };
  }

  if (response.status === 401) {
    // Entry stays pending_sync so it replays after the user signs back in.
    await putEntry({ ...entry, status: "pending_sync", lastError: "http_401" });

    return { kind: "retry", id: entry.id, error: "http_401" };
  }

  if (response.ok) {
    const payload = await readJsonSafe(response);
    const success = pickSuccessPayload(payload);

    if (!success) {
      await putEntry({
        ...entry,
        status: "failed",
        lastError: "internal_error",
      });

      return { kind: "failed", id: entry.id, code: "internal_error" };
    }

    await putEntry({
      ...entry,
      status: "sent",
      lastError: null,
      serverStatus: success.status,
      alreadyCheckedIn: success.alreadyCheckedIn,
    });

    return {
      kind: "sent",
      id: entry.id,
      serverStatus: success.status,
      alreadyCheckedIn: success.alreadyCheckedIn,
    };
  }

  const payload = await readJsonSafe(response);
  const code = pickErrorCode(payload);

  if (
    response.status >= 500 ||
    code === "service_unavailable" ||
    code === "internal_error"
  ) {
    await putEntry({
      ...entry,
      status: "pending_sync",
      attempts: entry.attempts + 1,
      lastError: code ?? `http_${response.status}`,
    });

    return {
      kind: "retry",
      id: entry.id,
      error: code ?? `http_${response.status}`,
    };
  }

  if (code && TERMINAL_CODES.has(code)) {
    await putEntry({ ...entry, status: "failed", lastError: code });

    return { kind: "failed", id: entry.id, code };
  }

  // Unknown error codes are treated as retryable: silently discarding the
  // user's tap would be worse than surfacing it for manual follow-up.
  await putEntry({
    ...entry,
    status: "pending_sync",
    attempts: entry.attempts + 1,
    lastError: code ?? `http_${response.status}`,
  });

  return {
    kind: "retry",
    id: entry.id,
    error: code ?? `http_${response.status}`,
  };
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
