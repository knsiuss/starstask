import { describe, expect, it } from "vitest";

import { distanceMeters } from "@/lib/geo/position";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it("measures about 111 km per degree of latitude", () => {
    const distance = distanceMeters(0, 0, 1, 0);

    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });

  it("shrinks longitude distance near the poles", () => {
    const equator = distanceMeters(0, 0, 0, 1);
    const nearPole = distanceMeters(80, 0, 80, 1);

    expect(nearPole).toBeLessThan(equator);
  });
});
