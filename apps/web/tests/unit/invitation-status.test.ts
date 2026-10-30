import { describe, expect, it } from "vitest";

import {
  getInvitationStatus,
  isInvitationActive,
} from "@/lib/classes/invitation-status";

const NOW = new Date("2026-10-29T03:00:00.000Z");

const BASE = {
  expires_at: "2026-10-30T03:00:00.000Z",
  max_uses: 2,
  used_count: 1,
  revoked_at: null,
} as const;

describe("getInvitationStatus", () => {
  it("counts a link with remaining uses as active", () => {
    expect(getInvitationStatus(BASE, NOW)).toBe("active");
    expect(isInvitationActive(BASE, NOW)).toBe(true);
  });

  it("allows a multi-use link while uses remain", () => {
    expect(
      getInvitationStatus({ ...BASE, max_uses: 500, used_count: 499 }, NOW),
    ).toBe("active");
  });

  it("marks an exhausted link inactive", () => {
    expect(
      getInvitationStatus({ ...BASE, max_uses: 1, used_count: 1 }, NOW),
    ).toBe("exhausted");
    expect(
      isInvitationActive({ ...BASE, max_uses: 1, used_count: 1 }, NOW),
    ).toBe(false);
  });

  it("marks a revoked link inactive even when it has uses left", () => {
    expect(
      getInvitationStatus(
        { ...BASE, revoked_at: "2026-10-29T02:00:00.000Z" },
        NOW,
      ),
    ).toBe("revoked");
  });

  it("treats the expiry instant itself as expired", () => {
    expect(
      getInvitationStatus({ ...BASE, expires_at: NOW.toISOString() }, NOW),
    ).toBe("expired");
  });

  it("treats an unparseable expiry as expired rather than active", () => {
    expect(getInvitationStatus({ ...BASE, expires_at: "nope" }, NOW)).toBe(
      "expired",
    );
  });

  it("treats revocation as the strongest state", () => {
    expect(
      getInvitationStatus(
        {
          ...BASE,
          revoked_at: "2026-10-29T02:00:00.000Z",
          expires_at: "2026-10-28T03:00:00.000Z",
          used_count: 2,
        },
        NOW,
      ),
    ).toBe("revoked");
  });
});
