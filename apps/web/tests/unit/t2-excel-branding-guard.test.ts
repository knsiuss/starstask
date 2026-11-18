import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exportBrandingSchema,
  isAllowedBrandingLogoUrl,
} from "@starstask/contracts";

import { loadBrandingImage } from "@/features/attendance-meetings/excel-header-image";

const VALID_PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("exportBrandingSchema logoUrl allowlist", () => {
  it("allows empty, safe public paths, internal branding proxy keys, and Supabase class-media URLs", () => {
    expect(isAllowedBrandingLogoUrl("")).toBe(true);
    expect(isAllowedBrandingLogoUrl("/aphelion-logo.png")).toBe(true);
    expect(
      isAllowedBrandingLogoUrl(
        "/api/media/class-media/class-123/branding/logo-1.png",
      ),
    ).toBe(true);
    expect(
      isAllowedBrandingLogoUrl(
        "https://abc.supabase.co/storage/v1/object/public/class-media/class-123/branding/logo.jpg",
      ),
    ).toBe(true);
  });

  it("rejects arbitrary external https hosts, protocol-relative URLs, traversal, and internal non-branding API paths", () => {
    expect(isAllowedBrandingLogoUrl("https://evil.example/logo.png")).toBe(
      false,
    );
    expect(isAllowedBrandingLogoUrl("http://169.254.169.254/latest")).toBe(
      false,
    );
    expect(isAllowedBrandingLogoUrl("//evil.example/logo.png")).toBe(false);
    expect(isAllowedBrandingLogoUrl("/../../etc/passwd")).toBe(false);
    expect(isAllowedBrandingLogoUrl("/\\Windows\\win.ini")).toBe(false);
    expect(isAllowedBrandingLogoUrl("/api/media/avatars/user-1/pic.png")).toBe(
      false,
    );

    const parsed = exportBrandingSchema.safeParse({
      universityName: "Test University",
      universityLogoUrl: "https://evil.example/ssrf.png",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("loadBrandingImage SSRF and path traversal guards", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    vi.restoreAllMocks();
  });

  it("rejects arbitrary external https URLs without fetching", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      loadBrandingImage("https://169.254.169.254/latest/meta-data"),
    ).rejects.toThrow();
    await expect(
      loadBrandingImage(
        "https://other.supabase.co/storage/v1/object/public/class-media/c1/branding/l1.png",
      ),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects Windows backslashes, drive colons, and parent traversal in public paths", async () => {
    await expect(loadBrandingImage("/../package.json")).rejects.toThrow();
    await expect(loadBrandingImage("/\\Windows\\win.ini")).rejects.toThrow();
    await expect(loadBrandingImage("/C:/Windows/win.ini")).rejects.toThrow();
  });

  it("rejects cross-class internal branding media paths when classId is provided", async () => {
    await expect(
      loadBrandingImage(
        "/api/media/class-media/other-class/branding/logo.png",
        "expected-class",
      ),
    ).rejects.toThrow("Logo does not belong to this class");
  });

  it("loads the built-in public logo with PNG magic bytes", async () => {
    const result = await loadBrandingImage("/aphelion-logo.png");

    expect(result.extension).toBe("png");
    expect(result.buffer.byteLength).toBeGreaterThan(8);
  });

  it("fetches allowed Supabase storage URL with redirect:error and verifies magic bytes", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(VALID_PNG_BYTES, {
        status: 200,
        headers: { "content-length": String(VALID_PNG_BYTES.byteLength) },
      }),
    );

    const result = await loadBrandingImage(
      "https://project.supabase.co/storage/v1/object/public/class-media/class-1/branding/logo-1.png",
      "class-1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/public/class-media/class-1/branding/logo-1.png",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(result.extension).toBe("png");
  });

  it("rejects responses with invalid image magic bytes or exceeding 2 MB", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new TextEncoder().encode("<html>xss</html>"), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(VALID_PNG_BYTES, {
          status: 200,
          headers: { "content-length": String(3 * 1024 * 1024) },
        }),
      );

    await expect(
      loadBrandingImage(
        "https://project.supabase.co/storage/v1/object/public/class-media/class-1/branding/fake.png",
        "class-1",
      ),
    ).rejects.toThrow("Unsupported image signature");

    await expect(
      loadBrandingImage(
        "https://project.supabase.co/storage/v1/object/public/class-media/class-1/branding/huge.png",
        "class-1",
      ),
    ).rejects.toThrow("Logo response exceeds size limit");
  });
});
