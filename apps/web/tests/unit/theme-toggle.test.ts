import { describe, expect, it } from "vitest";

import { THEME_BOOT_SCRIPT } from "@/lib/theme";

describe("theme boot script", () => {
  it("resolves the stored theme before first paint", () => {
    expect(THEME_BOOT_SCRIPT).toContain("starstask:theme");
    expect(THEME_BOOT_SCRIPT).toContain('classList.add("dark")');
    expect(THEME_BOOT_SCRIPT).toContain("prefers-color-scheme: dark");
  });

  it("never throws when storage is unavailable", () => {
    expect(THEME_BOOT_SCRIPT).toContain("try{");
    expect(THEME_BOOT_SCRIPT).toContain("}catch(e){}");
  });
});
