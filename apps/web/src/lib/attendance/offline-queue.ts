"use client";

/**
 * Offline check-in queue (PWA):
 * - Di basement kampus sinyal jelek: simpan check-in ke localStorage + tabel offline_checkin_queue
 * - Sync otomatis saat online via navigator.onLine + event online
 */

const QUEUE_KEY = "starstask-offline-checkins";

export type OfflineCheckin = {
  id: string;
  sessionId: string;
  payload: Record<string, unknown>;
  capturedAt: string;
};

export function queueOfflineCheckin(
  sessionId: string,
  payload: Record<string, unknown>,
): void {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID(),
    sessionId,
    payload,
    capturedAt: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): OfflineCheckin[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineCheckin[]) : [];
  } catch {
    return [];
  }
}

export async function syncOfflineQueue(
  send: (item: OfflineCheckin) => Promise<void>,
): Promise<number> {
  const queue = getQueue();
  let synced = 0;
  const remaining: OfflineCheckin[] = [];
  for (const item of queue) {
    try {
      await send(item);
      synced++;
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return synced;
}

export function watchOnline(onSync: () => Promise<number>): () => void {
  function handler() {
    if (navigator.onLine) void onSync();
  }
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
