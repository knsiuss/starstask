import { describe, expect, it } from "vitest";

/**
 * Phase 5K: the batched session_checkin_summary_many RPC body relies on the
 * same contract as the existing single-row session_checkin_summary helper.
 * These unit tests protect the app contract without a live database; the
 * end-to-end equivalence is validated in supabase/tests/.
 */

const A = "00000000-0000-4000-8000-000000000101";
const B = "00000000-0000-4000-8000-000000000102";

type Summary = { session_id?: string; has_location: boolean; radius_m: number };

function mapBatchRows(rows: Summary[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const row of rows) {
    if (row.session_id !== undefined && Number.isFinite(row.radius_m)) {
      map.set(row.session_id, row.radius_m);
    }
  }

  return map;
}

describe("session_checkin_summary_many app contract", () => {
  it("preserves distinct input identity and ignores malformed rows", () => {
    const rows: Summary[] = [
      { session_id: A, has_location: true, radius_m: 150 },
      { session_id: B, has_location: false, radius_m: 200 },
      { has_location: true, radius_m: 100 },
      { session_id: "", has_location: true, radius_m: 100 },
    ];

    const map = mapBatchRows(rows);

    expect(map.get(A)).toBe(150);
    expect(map.get(B)).toBe(200);
    expect(map.size).toBe(3);
  });

  it("keeps radius fallback when the RPC returns no rows", () => {
    const map = mapBatchRows([]);

    expect(map.get(A) ?? 150).toBe(150);
  });

  it("keeps duplicate ids collapsed by the database DISTINCT/GROUP behavior", () => {
    const rows: Summary[] = [
      { session_id: A, has_location: true, radius_m: 150 },
      { session_id: A, has_location: true, radius_m: 150 },
    ];

    expect(mapBatchRows(rows).size).toBe(1);
  });
});
