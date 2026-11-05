import { describe, expect, it } from "vitest";

import { fetchAllRows } from "@/lib/db/fetch-all";

function page(rows: number[], error: { code?: string } | null = null) {
  return { data: rows, error };
}

describe("fetchAllRows", () => {
  it("stops at the first short page", async () => {
    const calls: Array<[number, number]> = [];

    const rows = await fetchAllRows(
      async (from, to) => {
        calls.push([from, to]);
        return page(from === 0 ? [1, 2] : [3]);
      },
      () => {
        throw new Error("unexpected error");
      },
      2,
    );

    expect(rows).toEqual([1, 2, 3]);
    expect(calls).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("returns an empty list when the first page is empty", async () => {
    const rows = await fetchAllRows(
      async () => page([]),
      () => {
        throw new Error("unexpected error");
      },
      2,
    );

    expect(rows).toEqual([]);
  });

  it("propagates page errors through the error callback", async () => {
    await expect(
      fetchAllRows(
        async () => page([], { code: "PGRST000" }),
        (code) => {
          throw new Error(`failed:${code}`);
        },
        2,
      ),
    ).rejects.toThrow("failed:PGRST000");
  });

  it("keeps fetching while pages are full", async () => {
    let total = 0;

    const rows = await fetchAllRows(
      async (from) => {
        const batch = [from + 1, from + 2];
        total += batch.length;
        return page(total < 6 ? batch : [5]);
      },
      () => {
        throw new Error("unexpected error");
      },
      2,
    );

    expect(rows).toEqual([1, 2, 3, 4, 5]);
  });
});
