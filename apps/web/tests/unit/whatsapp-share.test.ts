import { describe, expect, it } from "vitest";

import {
  buildWhatsAppShareText,
  buildWhatsAppShareUrl,
} from "@/lib/share/whatsapp";

const URL = "https://starstask.example/assignments/abc";

describe("buildWhatsAppShareText", () => {
  it("lists the title, deadline, and link in that order", () => {
    const text = buildWhatsAppShareText({
      title: "Database normalization exercise",
      deadline: "2026-11-12T23:59:00+07:00",
      url: URL,
    });

    const lines = text.split("\n");

    expect(lines[0]).toBe("Database normalization exercise");
    expect(lines[1]).toContain("12 Nov 2026");
    expect(lines[1]).toContain("WIB");
    expect(lines[2]).toBe(URL);
  });

  it("omits the deadline line when there is no deadline", () => {
    const text = buildWhatsAppShareText({
      title: "Reading response",
      deadline: null,
      url: URL,
    });

    expect(text).toBe(`Reading response\n${URL}`);
  });

  it("omits an unparseable deadline instead of printing Invalid date", () => {
    const text = buildWhatsAppShareText({
      title: "Reading response",
      deadline: "not-a-date",
      url: URL,
    });

    expect(text).toBe(`Reading response\n${URL}`);
  });

  it("trims the title", () => {
    const text = buildWhatsAppShareText({
      title: "  Spaced title  ",
      deadline: null,
      url: URL,
    });

    expect(text.startsWith("Spaced title\n")).toBe(true);
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("encodes the message into a wa.me link", () => {
    const shareUrl = buildWhatsAppShareUrl({
      title: "Database normalization exercise",
      deadline: "2026-11-12T23:59:00+07:00",
      url: URL,
    });

    expect(shareUrl.startsWith("https://wa.me/?text=")).toBe(true);
    expect(shareUrl).not.toContain("\n");
    expect(shareUrl).not.toContain(" ");
    expect(decodeURIComponent(shareUrl.split("text=")[1] ?? "")).toBe(
      buildWhatsAppShareText({
        title: "Database normalization exercise",
        deadline: "2026-11-12T23:59:00+07:00",
        url: URL,
      }),
    );
  });
});
