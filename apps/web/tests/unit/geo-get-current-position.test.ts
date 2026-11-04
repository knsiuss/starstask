import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentPosition } from "@/lib/geo/position";

/**
 * Regression test: a real GeolocationPosition exposes `coords`/`timestamp`
 * as prototype getters, so spreading it yields `{}`. The helper must copy
 * the fields explicitly or every caller sees `coords === undefined`.
 */
describe("getCurrentPosition", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves coords and capturedAt from a prototype-getter position", async () => {
    const coords = {
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 12,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    };

    class FakePosition {
      get coords() {
        return coords;
      }

      get timestamp() {
        return 1_700_000_000_000;
      }
    }

    const holder: { onSuccess?: (position: unknown) => void } = {};

    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (onSuccess: (position: unknown) => void) => {
          holder.onSuccess = onSuccess;
        },
      },
    });

    const promise = getCurrentPosition();

    if (!holder.onSuccess) {
      throw new Error("Expected the geolocation mock to be called");
    }

    holder.onSuccess(new FakePosition());
    const position = await promise;

    expect(position.coords.latitude).toBe(-6.2);
    expect(position.coords.longitude).toBe(106.8);
    expect(position.capturedAt).toBe(1_700_000_000_000);
  });

  it("rejects when geolocation is unsupported", async () => {
    vi.stubGlobal("navigator", {});

    await expect(getCurrentPosition()).rejects.toThrow("unsupported");
  });
});
