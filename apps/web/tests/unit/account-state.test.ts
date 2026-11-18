import { describe, expect, it } from "vitest";

import { resolveAccountLifecycleState } from "@/lib/auth/account-state";

describe("resolveAccountLifecycleState", () => {
  const cases = [
    {
      name: "null profile resolves to active",
      profile: null,
      expected: "active",
    },
    {
      name: "empty profile (no fields) resolves to active",
      profile: {},
      expected: "active",
    },
    {
      name: "deleted_at set resolves to deleted",
      profile: { deleted_at: "2026-11-18T00:00:00.000Z" },
      expected: "deleted",
    },
    {
      name: "deleted_at wins over deactivated_at",
      profile: {
        deleted_at: "2026-11-18T00:00:00.000Z",
        deactivated_at: "2026-11-17T00:00:00.000Z",
      },
      expected: "deleted",
    },
    {
      name: "deleted_at wins over account_status='deactivated'",
      profile: {
        deleted_at: "2026-11-18T00:00:00.000Z",
        account_status: "deactivated",
      },
      expected: "deleted",
    },
    {
      name: "account_status='deactivated' resolves to deactivated",
      profile: { account_status: "deactivated" },
      expected: "deactivated",
    },
    {
      name: "account_status='deleted' resolves to deleted",
      profile: { account_status: "deleted" },
      expected: "deleted",
    },
    {
      name: "account_status='active' resolves to active",
      profile: { account_status: "active" },
      expected: "active",
    },
    {
      name: "unknown status with no timestamps falls back to active",
      profile: { account_status: "banana" },
      expected: "active",
    },
    {
      name: "unknown status does not override a deleted_at timestamp",
      profile: {
        account_status: "banana",
        deleted_at: "2026-11-18T00:00:00.000Z",
      },
      expected: "deleted",
    },
    {
      name: "deactivated_at timestamp resolves to deactivated",
      profile: { deactivated_at: "2026-11-17T00:00:00.000Z" },
      expected: "deactivated",
    },
  ] as const;

  for (const { name, profile, expected } of cases) {
    it(name, () => {
      expect(resolveAccountLifecycleState(profile)).toBe(expected);
    });
  }
});
