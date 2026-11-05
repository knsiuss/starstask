/**
 * Offline check-in queue for the mobile shell.
 *
 * When a check-in cannot reach the server (no signal in a campus
 * basement), the captured position is persisted locally and retried when
 * connectivity returns. Items only leave the queue after the server
 * accepts them — a rejected item stays queued and surfaces its message
 * instead of being silently dropped.
 */

export type PendingCheckIn = {
  id: string;
  sessionId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  fullName: string;
  nim: string;
  capturedAt: string;
};

const QUEUE_KEY = "starstask-mobile-offline-checkins";

export function getOfflineQueue(): PendingCheckIn[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingCheckIn[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingCheckIn[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full/blocked: the queue simply does not persist this round.
  }
}

export function queueOfflineCheckin(
  item: Omit<PendingCheckIn, "id" | "capturedAt">,
): PendingCheckIn {
  const queued: PendingCheckIn = {
    ...item,
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
  };
  saveQueue([...getOfflineQueue(), queued]);
  return queued;
}

export async function syncOfflineQueue(
  send: (item: PendingCheckIn) => Promise<boolean>,
): Promise<{ synced: number; remaining: number }> {
  const queue = getOfflineQueue();
  const remaining: PendingCheckIn[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const ok = await send(item);
      if (ok) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { synced, remaining: remaining.length };
}
