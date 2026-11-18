import { describe, expect, it } from "vitest";

import {
  isAllowedGoogleMapsHost,
  parseGoogleMapsHtml,
  parseGoogleMapsUrl,
} from "@/lib/geo/google-maps";

describe("parseGoogleMapsUrl", () => {
  it("extracts @lat,lng from a place URL", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/X/@-6.3608,106.8272,15z",
      ),
    ).toEqual({ latitude: -6.3608, longitude: 106.8272 });
  });

  it("extracts !3d!4d embed markers", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/embed?pb=!4v1!3d-6.36!4d106.82",
      ),
    ).toEqual({ latitude: -6.36, longitude: 106.82 });
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/@95,200"),
    ).toBeNull();
  });

  it("returns null when no coordinates are present", () => {
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/search/cafe"),
    ).toBeNull();
  });

  it("handles malformed percent-encoding without throwing URIError", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/%ZZ/@-6.3608,106.8272,15z",
      ),
    ).toEqual({ latitude: -6.3608, longitude: 106.8272 });
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/search/%E0%A4%A"),
    ).toBeNull();
  });
});

describe("isAllowedGoogleMapsHost", () => {
  it("allows google.com and short links", () => {
    expect(isAllowedGoogleMapsHost("https://maps.app.goo.gl/abc")).toBe(true);
    expect(isAllowedGoogleMapsHost("https://goo.gl/maps/abc")).toBe(true);
    expect(isAllowedGoogleMapsHost("https://www.google.com/maps")).toBe(true);
    expect(isAllowedGoogleMapsHost("https://maps.google.co.id/maps")).toBe(
      true,
    );
  });

  it("rejects non-maps Google subdomains, other hosts, and non-https", () => {
    expect(isAllowedGoogleMapsHost("https://sites.google.com/view/x")).toBe(
      false,
    );
    expect(
      isAllowedGoogleMapsHost("https://script.google.com/macros/s/x/exec"),
    ).toBe(false);
    expect(isAllowedGoogleMapsHost("https://accounts.google.com/")).toBe(false);
    expect(isAllowedGoogleMapsHost("https://evil.example/maps")).toBe(false);
    expect(isAllowedGoogleMapsHost("http://maps.app.goo.gl/abc")).toBe(false);
  });
});

describe("parseGoogleMapsHtml", () => {
  it("extracts !3d!4d markers from page HTML", () => {
    expect(
      parseGoogleMapsHtml('<a href="/maps/embed?pb=!3d-6.36!4d106.82">x</a>'),
    ).toEqual({ latitude: -6.36, longitude: 106.82 });
  });

  it("extracts coordinates from inline JSON lat/lng blob", () => {
    expect(
      parseGoogleMapsHtml(
        '<script>var x={"latitude":-6.36,"longitude":106.82};</script>',
      ),
    ).toEqual({ latitude: -6.36, longitude: 106.82 });
  });
});
