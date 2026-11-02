import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_RETENTION_DAYS,
  MAX_NOTIFICATION_RETENTION_DAYS,
  resolveNotificationRetentionDays,
} from "@/lib/push/retention";

describe("resolveNotificationRetentionDays", () => {
  it("defaults when the variable is absent", () => {
    expect(resolveNotificationRetentionDays({})).toBe(
      DEFAULT_NOTIFICATION_RETENTION_DAYS,
    );
  });

  it("trims and accepts a valid window", () => {
    expect(
      resolveNotificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: " 45 " }),
    ).toBe(45);
  });

  it.each(["0", "-1", "1.5", "forever", "3651"])(
    "falls back for an invalid value (%s)",
    (value) => {
      expect(
        resolveNotificationRetentionDays({
          NOTIFICATION_RETENTION_DAYS: value,
        }),
      ).toBe(DEFAULT_NOTIFICATION_RETENTION_DAYS);
    },
  );

  it("accepts the maximum window", () => {
    expect(
      resolveNotificationRetentionDays({
        NOTIFICATION_RETENTION_DAYS: String(MAX_NOTIFICATION_RETENTION_DAYS),
      }),
    ).toBe(MAX_NOTIFICATION_RETENTION_DAYS);
  });
});
