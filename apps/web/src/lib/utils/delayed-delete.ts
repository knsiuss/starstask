/**
 * Defers a destructive request so a toast can offer "Undo".
 *
 * The pending request lives outside React state: navigating away must not
 * cancel it. If the page is hidden or unloaded before the timer fires, the
 * request is sent immediately with `keepalive` so the delete still happens.
 */

type PendingDelete = {
  timer: ReturnType<typeof setTimeout>;
  send: () => void;
};

const pendingDeletes = new Map<string, PendingDelete>();
let isFlushInstalled = false;

function flushPendingDeletes() {
  for (const [key, pending] of pendingDeletes) {
    clearTimeout(pending.timer);
    pendingDeletes.delete(key);
    pending.send();
  }
}

function installFlushHandler() {
  if (isFlushInstalled || typeof window === "undefined") {
    return;
  }

  isFlushInstalled = true;
  window.addEventListener("pagehide", flushPendingDeletes);
}

/**
 * Runs `send` after `delayMs` unless the same key is cancelled first.
 *
 * Scheduling the same key twice replaces the earlier request, so a double
 * confirm cannot delete twice.
 */
export function scheduleDelete(
  key: string,
  send: () => void,
  delayMs: number,
): void {
  installFlushHandler();
  cancelScheduledDelete(key);

  const timer = setTimeout(() => {
    pendingDeletes.delete(key);
    send();
  }, delayMs);

  pendingDeletes.set(key, { timer, send });
}

/** Returns false when the request already fired or was never scheduled. */
export function cancelScheduledDelete(key: string): boolean {
  const pending = pendingDeletes.get(key);

  if (!pending) {
    return false;
  }

  clearTimeout(pending.timer);
  pendingDeletes.delete(key);

  return true;
}
