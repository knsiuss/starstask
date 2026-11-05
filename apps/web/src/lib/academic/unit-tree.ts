/**
 * Pure parent-child projection for the academic unit registry.
 *
 * Kept free of I/O and server-only guards so the tree rules are unit-testable
 * without a database.
 */

export type AcademicUnitRow = {
  id: string;
  parentId: string | null;
  code: string | null;
  name: string;
  unitType: string;
  status: string;
};

export type UnitTreeNode = AcademicUnitRow & { children: UnitTreeNode[] };

/**
 * Nests units under their parents, cloning rows. Orphans (parent filtered
 * out by status or missing) are surfaced at the root rather than dropped;
 * siblings are sorted by name at every depth.
 */
export function buildUnitTree(units: AcademicUnitRow[]): UnitTreeNode[] {
  const nodes = new Map<string, UnitTreeNode>();

  for (const unit of units) {
    nodes.set(unit.id, { ...unit, children: [] });
  }

  const roots: UnitTreeNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursively = (list: UnitTreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));

    for (const node of list) {
      sortRecursively(node.children);
    }
  };

  sortRecursively(roots);

  return roots;
}

/** Depth-first flatten with depth labels, capped for display. */
export function flattenUnitTree(
  tree: UnitTreeNode[],
  maxDepth = 2,
): Array<{ node: UnitTreeNode; depth: number }> {
  const out: Array<{ node: UnitTreeNode; depth: number }> = [];

  const walk = (nodes: UnitTreeNode[], depth: number) => {
    if (depth > maxDepth) {
      return;
    }

    for (const node of nodes) {
      out.push({ node, depth });
      walk(node.children, depth + 1);
    }
  };

  walk(tree, 0);

  return out;
}
