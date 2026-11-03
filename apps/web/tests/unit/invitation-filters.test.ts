import { describe, expect, it } from "vitest";

import {
  filterInvitations,
  getInvitationCounts,
  getUsagePercent,
} from "@/lib/classes/invitation-filters";

const NOW = new Date("2026-11-01T03:00:00.000Z");

const INVITATIONS = [
  {
    id: "active",
    email_restriction: "student@example.edu",
    expires_at: "2026-11-08T03:00:00.000Z",
    max_uses: 5,
    used_count: 2,
    revoked_at: null,
  },
  {
    id: "open",
    email_restriction: null,
    expires_at: "2026-11-08T03:00:00.000Z",
    max_uses: 10,
    used_count: 0,
    revoked_at: null,
  },
  {
    id: "expired",
    email_restriction: null,
    expires_at: "2026-10-30T03:00:00.000Z",
    max_uses: 1,
    used_count: 0,
    revoked_at: null,
  },
  {
    id: "exhausted",
    email_restriction: "used@example.edu",
    expires_at: "2026-11-08T03:00:00.000Z",
    max_uses: 1,
    used_count: 1,
    revoked_at: null,
  },
  {
    id: "revoked",
    email_restriction: "gone@example.edu",
    expires_at: "2026-11-08T03:00:00.000Z",
    max_uses: 3,
    used_count: 0,
    revoked_at: "2026-10-31T03:00:00.000Z",
  },
] as const;

describe("getInvitationCounts", () => {
  it("counts every status and totals all invitations", () => {
    expect(getInvitationCounts(INVITATIONS, NOW)).toEqual({
      all: 5,
      active: 2,
      expired: 1,
      exhausted: 1,
      revoked: 1,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(getInvitationCounts([], NOW)).toEqual({
      all: 0,
      active: 0,
      expired: 0,
      exhausted: 0,
      revoked: 0,
    });
  });
});

describe("filterInvitations", () => {
  it("returns every invitation for the all filter without a query", () => {
    expect(
      filterInvitations(INVITATIONS, "all", "", NOW).map((item) => item.id),
    ).toEqual(["active", "open", "expired", "exhausted", "revoked"]);
  });

  it("narrows to a single status", () => {
    expect(
      filterInvitations(INVITATIONS, "exhausted", "", NOW).map(
        (item) => item.id,
      ),
    ).toEqual(["exhausted"]);
  });

  it("matches email restrictions case-insensitively", () => {
    expect(
      filterInvitations(INVITATIONS, "all", "STUDENT@", NOW).map(
        (item) => item.id,
      ),
    ).toEqual(["active"]);
  });

  it("matches unrestricted links by their display label", () => {
    expect(
      filterInvitations(INVITATIONS, "all", "anyone", NOW).map(
        (item) => item.id,
      ),
    ).toEqual(["open", "expired"]);
  });

  it("combines a status filter with a search query", () => {
    expect(
      filterInvitations(INVITATIONS, "active", "example.edu", NOW).map(
        (item) => item.id,
      ),
    ).toEqual(["active"]);
    expect(filterInvitations(INVITATIONS, "active", "gone", NOW)).toEqual([]);
  });
});

describe("getUsagePercent", () => {
  it("rounds the used fraction to a whole percentage", () => {
    expect(getUsagePercent(1, 3)).toBe(33);
    expect(getUsagePercent(2, 3)).toBe(67);
  });

  it("clamps the result between 0 and 100", () => {
    expect(getUsagePercent(5, 5)).toBe(100);
    expect(getUsagePercent(9, 5)).toBe(100);
    expect(getUsagePercent(-1, 5)).toBe(0);
  });

  it("guards against a missing or zero limit", () => {
    expect(getUsagePercent(3, 0)).toBe(0);
    expect(getUsagePercent(3, Number.NaN)).toBe(0);
  });
});
