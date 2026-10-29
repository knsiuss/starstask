import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

const SECRET = "a".repeat(48);

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://starstask.example/api/cron/deadline-reminders", {
    headers,
  });
}

describe("isAuthorizedCronRequest", () => {
  it("accepts the configured bearer token", () => {
    expect(
      isAuthorizedCronRequest(
        request({ authorization: `Bearer ${SECRET}` }),
        SECRET,
      ),
    ).toBe(true);
  });

  it("rejects a wrong token of the same length", () => {
    expect(
      isAuthorizedCronRequest(
        request({ authorization: `Bearer ${"b".repeat(48)}` }),
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a token of a different length without comparing bytes", () => {
    expect(
      isAuthorizedCronRequest(
        request({ authorization: "Bearer short" }),
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorizedCronRequest(request(), SECRET)).toBe(false);
  });

  it("rejects a non-bearer scheme", () => {
    expect(
      isAuthorizedCronRequest(
        request({ authorization: `Basic ${SECRET}` }),
        SECRET,
      ),
    ).toBe(false);
  });

  it("is case-sensitive about the bearer prefix", () => {
    expect(
      isAuthorizedCronRequest(
        request({ authorization: `bearer ${SECRET}` }),
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(
      isAuthorizedCronRequest(
        request({ authorization: `Bearer ${SECRET}` }),
        undefined,
      ),
    ).toBe(false);
    expect(
      isAuthorizedCronRequest(request({ authorization: "Bearer " }), ""),
    ).toBe(false);
  });
});
