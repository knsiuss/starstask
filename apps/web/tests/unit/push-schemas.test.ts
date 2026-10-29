import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_TIMEZONE,
  isAcceptablePushEndpoint,
  isValidTimeZone,
  notificationPreferencesSchema,
  pushEndpointSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  savedAssignmentSchema,
} from "@starstask/contracts";

const ASSIGNMENT_ID = "3f2b6c1e-8a4d-4f6b-9c2e-1d5a7b9c0e3f";
const VALID_ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const VALID_P256DH = "B".repeat(20);
const VALID_AUTH = "A".repeat(10);

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: VALID_ENDPOINT,
    keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
    ...overrides,
  };
}

describe("isAcceptablePushEndpoint", () => {
  it("accepts an HTTPS endpoint with a DNS hostname", () => {
    expect(isAcceptablePushEndpoint(VALID_ENDPOINT)).toBe(true);
  });

  it("accepts an explicit 443 port", () => {
    expect(
      isAcceptablePushEndpoint("https://push.example.com:443/send/abc"),
    ).toBe(true);
  });

  it.each([
    { label: "plain HTTP", value: "http://fcm.googleapis.com/fcm/send/abc" },
    { label: "localhost", value: "https://localhost/send/abc" },
    { label: "a .localhost name", value: "https://push.localhost/send/abc" },
    { label: "an IPv4 literal", value: "https://127.0.0.1/send/abc" },
    { label: "an IPv6 literal", value: "https://[::1]/send/abc" },
    {
      label: "a non-443 port",
      value: "https://push.example.com:8443/send/abc",
    },
    {
      label: "embedded credentials",
      value: "https://user:pass@push.example.com/send/abc",
    },
    { label: "a non-URL", value: "not a url" },
  ])("rejects $label", ({ value }) => {
    expect(isAcceptablePushEndpoint(value)).toBe(false);
  });
});

describe("pushEndpointSchema", () => {
  it("rejects an endpoint longer than 2048 characters", () => {
    const longEndpoint = `https://push.example.com/${"a".repeat(2048)}`;

    expect(pushEndpointSchema.safeParse(longEndpoint).success).toBe(false);
  });
});

describe("pushSubscriptionSchema", () => {
  it("accepts a browser subscription", () => {
    const parsed = pushSubscriptionSchema.safeParse(subscription());

    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown top-level field instead of silently dropping it", () => {
    expect(
      pushSubscriptionSchema.safeParse(subscription({ userId: "attacker" }))
        .success,
    ).toBe(false);
  });

  it("rejects keys that are not base64url", () => {
    expect(
      pushSubscriptionSchema.safeParse(
        subscription({
          keys: { p256dh: "has spaces here!!", auth: VALID_AUTH },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects an auth secret that is too short", () => {
    expect(
      pushSubscriptionSchema.safeParse(
        subscription({ keys: { p256dh: VALID_P256DH, auth: "short" } }),
      ).success,
    ).toBe(false);
  });

  it("normalizes an empty device label to undefined", () => {
    const parsed = pushSubscriptionSchema.safeParse(
      subscription({ deviceLabel: "" }),
    );

    expect(parsed.success).toBe(true);
    expect(
      parsed.success ? parsed.data.deviceLabel : "unexpected",
    ).toBeUndefined();
  });

  it("rejects an over-long device label", () => {
    expect(
      pushSubscriptionSchema.safeParse(
        subscription({ deviceLabel: "x".repeat(61) }),
      ).success,
    ).toBe(false);
  });
});

describe("pushUnsubscribeSchema", () => {
  it("requires only a valid endpoint", () => {
    expect(
      pushUnsubscribeSchema.safeParse({ endpoint: VALID_ENDPOINT }).success,
    ).toBe(true);
  });

  it("rejects a missing endpoint", () => {
    expect(pushUnsubscribeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(
      pushUnsubscribeSchema.safeParse({ endpoint: VALID_ENDPOINT, id: "x" })
        .success,
    ).toBe(false);
  });
});

describe("notificationPreferencesSchema", () => {
  it("accepts a partial patch", () => {
    expect(
      notificationPreferencesSchema.safeParse({ reminder3h: false }).success,
    ).toBe(true);
  });

  it("rejects an empty patch so the API never no-ops silently", () => {
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(
      notificationPreferencesSchema.safeParse({
        pushEnabled: true,
        userId: "x",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid IANA time zone", () => {
    expect(
      notificationPreferencesSchema.safeParse({ timezone: "Asia/Makassar" })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown time zone", () => {
    expect(
      notificationPreferencesSchema.safeParse({ timezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
  });
});

describe("savedAssignmentSchema", () => {
  it("accepts a UUID", () => {
    expect(
      savedAssignmentSchema.safeParse({ assignmentId: ASSIGNMENT_ID }).success,
    ).toBe(true);
  });

  it("rejects a non-UUID id", () => {
    expect(
      savedAssignmentSchema.safeParse({ assignmentId: "123" }).success,
    ).toBe(false);
  });
});

describe("time zone helpers", () => {
  it("defaults to Asia/Jakarta", () => {
    expect(DEFAULT_NOTIFICATION_TIMEZONE).toBe("Asia/Jakarta");
  });

  it("recognizes real zones and rejects invented ones", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
