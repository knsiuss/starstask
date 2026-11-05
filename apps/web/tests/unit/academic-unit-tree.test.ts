import { describe, expect, it } from "vitest";

import { buildUnitTree, type AcademicUnitRow } from "@/lib/academic/unit-tree";

const unit = (
  id: string,
  parentId: string | null,
  name: string,
): AcademicUnitRow => ({
  id,
  parentId,
  code: null,
  name,
  unitType: "faculty",
  status: "active",
});

describe("buildUnitTree", () => {
  it("returns an empty list for no units", () => {
    expect(buildUnitTree([])).toEqual([]);
  });

  it("nests children under their parents", () => {
    const tree = buildUnitTree([
      unit("b", "a", "Beta Department"),
      unit("a", null, "Alpha Faculty"),
      unit("c", "a", "Gamma Department"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("a");
    expect(tree[0]?.children.map((node) => node.name)).toEqual([
      "Beta Department",
      "Gamma Department",
    ]);
  });

  it("surfaces orphans at the root instead of dropping them", () => {
    const tree = buildUnitTree([unit("x", "missing-parent", "Orphan")]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("x");
  });

  it("sorts siblings by name at every depth", () => {
    const tree = buildUnitTree([
      unit("a", null, "Zeta"),
      unit("b", null, "Alpha"),
      unit("c", "a", "Zulu Child"),
      unit("d", "a", "Alpha Child"),
    ]);

    expect(tree.map((node) => node.name)).toEqual(["Alpha", "Zeta"]);
    expect(tree[1]?.children.map((node) => node.name)).toEqual([
      "Alpha Child",
      "Zulu Child",
    ]);
  });
});
