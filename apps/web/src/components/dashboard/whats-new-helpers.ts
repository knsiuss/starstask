export const WHATS_NEW_VERSION = "2026-11-05";
export const SEEN_STORAGE_KEY = "starstask-whats-new-seen";

export const WHATS_NEW_HIGHLIGHTS = [
  {
    text: "Page transitions and loading skeletons keep navigation responsive.",
    href: "/app",
  },
  {
    text: "Manual check-in fallback lets your class admin mark attendance if GPS fails.",
    href: "/attendance",
  },
  {
    text: "Compact attendance history shows recent rows first with scroll for older entries.",
    href: "/attendance?tab=history",
  },
] as const;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function isWhatsNewDismissed(
  seenVersion: string | null,
  currentVersion: string = WHATS_NEW_VERSION,
): boolean {
  return seenVersion === currentVersion;
}

export function readSeenWhatsNewVersion(storage: StorageLike): string | null {
  try {
    return storage.getItem(SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistSeenWhatsNewVersion(
  storage: StorageLike,
  version: string = WHATS_NEW_VERSION,
): boolean {
  try {
    storage.setItem(SEEN_STORAGE_KEY, version);
    return true;
  } catch {
    return false;
  }
}
