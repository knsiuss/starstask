import { describe, expect, it } from "vitest";

import {
  isWhatsNewDismissed,
  persistSeenWhatsNewVersion,
  readSeenWhatsNewVersion,
  SEEN_STORAGE_KEY,
  WHATS_NEW_HIGHLIGHTS,
  WHATS_NEW_VERSION,
  type StorageLike,
} from "@/components/dashboard/whats-new-helpers";

function createMemoryStorage(
  initial: Record<string, string> = {},
): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

describe("WhatsNewBanner helpers", () => {
  it("treats only the current release version as dismissed", () => {
    expect(isWhatsNewDismissed(null)).toBe(false);
    expect(isWhatsNewDismissed("2026-10-01")).toBe(false);
    expect(isWhatsNewDismissed(WHATS_NEW_VERSION)).toBe(true);
  });

  it("supports explicit version comparison for release bumps", () => {
    expect(isWhatsNewDismissed("2026-11-05", "2026-11-05")).toBe(true);
    expect(isWhatsNewDismissed("2026-11-05", "2026-12-01")).toBe(false);
  });

  it("reads and persists the seen version using the shared storage key", () => {
    const storage = createMemoryStorage();

    expect(readSeenWhatsNewVersion(storage)).toBeNull();
    expect(persistSeenWhatsNewVersion(storage, "2026-11-05")).toBe(true);
    expect(storage.getItem(SEEN_STORAGE_KEY)).toBe("2026-11-05");
    expect(readSeenWhatsNewVersion(storage)).toBe("2026-11-05");
  });

  it("handles storage errors gracefully without throwing", () => {
    const brokenStorage: StorageLike = {
      getItem() {
        throw new Error("storage disabled");
      },
      setItem() {
        throw new Error("quota exceeded");
      },
    };

    expect(readSeenWhatsNewVersion(brokenStorage)).toBeNull();
    expect(persistSeenWhatsNewVersion(brokenStorage)).toBe(false);
  });

  it("uses clean copy without em dashes or external URLs", () => {
    expect(WHATS_NEW_HIGHLIGHTS.length).toBeGreaterThan(0);

    for (const item of WHATS_NEW_HIGHLIGHTS) {
      expect(item.text).not.toMatch(/[—–]/);
      expect(item.href.startsWith("/")).toBe(true);
    }
  });
});
