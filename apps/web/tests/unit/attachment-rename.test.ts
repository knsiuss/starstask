import { describe, expect, it } from "vitest";

import { attachmentRenameSchema } from "@starstask/contracts";

describe("attachmentRenameSchema", () => {
  it("accepts a plain display name with an extension", () => {
    const result = attachmentRenameSchema.safeParse({
      filename: "Diagram Sistem Informasi.png",
    });

    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = attachmentRenameSchema.safeParse({
      filename: "  brief final.pdf  ",
    });

    expect(result.success && result.data.filename).toBe("brief final.pdf");
  });

  it("rejects path separators", () => {
    expect(
      attachmentRenameSchema.safeParse({
        filename: "../other-user/brief.pdf",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(attachmentRenameSchema.safeParse({ filename: "   " }).success).toBe(
      false,
    );
  });

  it("rejects control characters", () => {
    expect(
      attachmentRenameSchema.safeParse({ filename: "brief\nfinal.pdf" })
        .success,
    ).toBe(false);
  });
});
