import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSignedUrl, mockCreateSupabaseAdminClient } = vi.hoisted(() => {
  const getSignedUrl = vi.fn(
    async (_client: unknown, command: unknown) =>
      `https://signed.example/${JSON.stringify(command)}`,
  );
  const createAdmin = vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
      })),
    },
  }));
  return {
    mockGetSignedUrl: getSignedUrl,
    mockCreateSupabaseAdminClient: createAdmin,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

import { toCheckInMethod } from "@/lib/db/attendance-meetings";
import { isValidMediaProxyKey, signStorageUrl } from "@/lib/storage/b2";
import {
  isCourseMediaInlinePath,
  uploadCourseMediaFile,
} from "@/lib/storage/course-media";

describe("media proxy key allowlist (B-01)", () => {
  it("allows 3-segment avatars and 3/4-segment class-media keys", () => {
    expect(isValidMediaProxyKey("avatars/user-1/avatar-abc.png")).toBe(true);
    expect(isValidMediaProxyKey("class-media/class-1/cover-1.jpg")).toBe(true);
    expect(
      isValidMediaProxyKey("class-media/class-1/branding/logo-1.jpeg"),
    ).toBe(true);
  });

  it("rejects arbitrary prefixes, traversal, extra segments, and disallowed extensions", () => {
    expect(isValidMediaProxyKey("assignments/user-1/secret.png")).toBe(false);
    expect(isValidMediaProxyKey("avatars/../secret/pic.png")).toBe(false);
    expect(isValidMediaProxyKey("class-media/class-1/other/logo.png")).toBe(
      false,
    );
    expect(isValidMediaProxyKey("class-media/class-1/branding/logo.html")).toBe(
      false,
    );
    expect(isValidMediaProxyKey("class-media/class-1/branding/logo.svg")).toBe(
      false,
    );
  });
});

describe("B2 Content-Disposition download filename sanitization (M-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.B2_APPLICATION_KEY_ID = "key-id";
    process.env.B2_APPLICATION_KEY = "app-key";
    process.env.B2_BUCKET_NAME = "bucket";
    process.env.B2_REGION = "us-west-001";
  });

  it("strips quotes, CR/LF, and backslashes from ResponseContentDisposition", async () => {
    await signStorageUrl("b2", "u1/a1/file.pdf", {
      download: 'evil"\r\nX-Injected: 1\\path.pdf',
    });

    const commandArg = mockGetSignedUrl.mock.calls[0]?.[1] as {
      input?: { ResponseContentDisposition?: string };
    };
    const disposition = commandArg?.input?.ResponseContentDisposition ?? "";

    expect(disposition).toBe(
      'attachment; filename="evil___X-Injected: 1_path.pdf"',
    );
    expect(disposition).not.toMatch(/[\r\n\\]/);
  });
});

describe("course-media HTML upload rejection and inline policy (H-09)", () => {
  it("rejects .html and .htm uploads", async () => {
    const htmlFile = new File(["<script>alert(1)</script>"], "evil.html", {
      type: "text/html",
    });
    const htmFile = new File(["<p>hi</p>"], "legacy.htm", {
      type: "text/html",
    });

    await expect(
      uploadCourseMediaFile({
        classId: "class-1",
        subjectId: "sub-1",
        folder: "materials",
        file: htmlFile,
      }),
    ).rejects.toThrow(
      "Supported files: PDF, Markdown, TXT, PNG, JPG, or WebP.",
    );

    await expect(
      uploadCourseMediaFile({
        classId: "class-1",
        subjectId: "sub-1",
        folder: "materials",
        file: htmFile,
      }),
    ).rejects.toThrow(
      "Supported files: PDF, Markdown, TXT, PNG, JPG, or WebP.",
    );
  });

  it("marks only PDF and supported image formats as inline-safe", () => {
    expect(isCourseMediaInlinePath("c1/s1/materials/doc.pdf")).toBe(true);
    expect(isCourseMediaInlinePath("c1/s1/materials/img.png")).toBe(true);
    expect(isCourseMediaInlinePath("c1/s1/materials/notes.md")).toBe(false);
    expect(isCourseMediaInlinePath("c1/s1/materials/readme.txt")).toBe(false);
    expect(isCourseMediaInlinePath("c1/s1/materials/legacy.html")).toBe(false);
  });
});

describe("toCheckInMethod (C-07)", () => {
  it("accepts geo, manual, system, and offline_sync", () => {
    expect(toCheckInMethod("geo")).toBe("geo");
    expect(toCheckInMethod("manual")).toBe("manual");
    expect(toCheckInMethod("system")).toBe("system");
    expect(toCheckInMethod("offline_sync")).toBe("offline_sync");
    expect(toCheckInMethod("other")).toBeNull();
    expect(toCheckInMethod(null)).toBeNull();
  });
});
