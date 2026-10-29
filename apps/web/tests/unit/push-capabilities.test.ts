import { describe, expect, it } from "vitest";

import {
  describePushSupport,
  detectIOS,
  getPushSupportStatus,
  readNotificationPermission,
  readPushEnvironment,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from "@/lib/push/capabilities";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

function environment(
  overrides: Partial<PushEnvironment> = {},
): PushEnvironment {
  return {
    isSecureContext: true,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    isIOS: false,
    isStandalone: false,
    ...overrides,
  };
}

describe("detectIOS", () => {
  it("recognizes an iPhone user agent", () => {
    expect(detectIOS(IPHONE_UA, 5)).toBe(true);
  });

  it("treats an iPad reporting a desktop user agent as iOS when it has touch points", () => {
    expect(detectIOS(IPAD_DESKTOP_UA, 5)).toBe(true);
  });

  it("does not treat a touchless Mac as iOS", () => {
    expect(detectIOS(MAC_UA, 0)).toBe(false);
  });

  it("does not treat Android as iOS", () => {
    expect(detectIOS(ANDROID_UA, 5)).toBe(false);
  });
});

describe("getPushSupportStatus", () => {
  it("reports an insecure context before anything else", () => {
    expect(getPushSupportStatus(environment({ isSecureContext: false }))).toBe(
      "insecure_context",
    );
  });

  it("asks an iOS browser in a normal tab to install the app first", () => {
    expect(
      getPushSupportStatus(
        environment({
          isIOS: true,
          hasPushManager: false,
          hasServiceWorker: false,
        }),
      ),
    ).toBe("ios_needs_install");
  });

  it("supports an installed iOS web app that exposes the APIs", () => {
    expect(
      getPushSupportStatus(environment({ isIOS: true, isStandalone: true })),
    ).toBe("supported");
  });

  it.each([
    { label: "service workers", overrides: { hasServiceWorker: false } },
    { label: "PushManager", overrides: { hasPushManager: false } },
    { label: "the Notification API", overrides: { hasNotification: false } },
  ])("reports an unsupported browser without $label", ({ overrides }) => {
    expect(getPushSupportStatus(environment(overrides))).toBe(
      "unsupported_browser",
    );
  });

  it("supports a modern non-iOS browser", () => {
    expect(getPushSupportStatus(environment())).toBe("supported");
  });
});

describe("describePushSupport", () => {
  it("only allows enabling when the browser is fully supported", () => {
    expect(describePushSupport("supported").canEnable).toBe(true);

    for (const status of [
      "ios_needs_install",
      "insecure_context",
      "unsupported_browser",
    ] as const) {
      expect(describePushSupport(status).canEnable).toBe(false);
    }
  });

  it("explains the iOS Home Screen requirement", () => {
    const copy = describePushSupport("ios_needs_install");

    expect(copy.title).toContain("Home Screen");
    expect(copy.description).toContain("Home Screen");
  });

  it("explains that Web Push needs HTTPS", () => {
    expect(describePushSupport("insecure_context").description).toContain(
      "HTTPS",
    );
  });
});

describe("browser probes", () => {
  it("returns null outside the browser instead of throwing", () => {
    expect(readPushEnvironment()).toBeNull();
    expect(readNotificationPermission()).toBe("unsupported");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a padded base64url value", () => {
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
  });

  it("adds the missing padding before decoding", () => {
    expect([...urlBase64ToUint8Array("AQI")]).toEqual([1, 2]);
  });

  it("translates the URL-safe alphabet", () => {
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
  });

  it("returns a view backed by a plain ArrayBuffer for PushManager", () => {
    const bytes = urlBase64ToUint8Array("AQID");

    expect(bytes.buffer).toBeInstanceOf(ArrayBuffer);
    expect(bytes.byteLength).toBe(3);
  });
});
