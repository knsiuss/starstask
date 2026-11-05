import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read-only projections for the grading domain. Nothing here publishes,
 * approves or mutates grades. The CSV column mapping is unresolved, so no
 * grade import exists; `grade_batches` are surfaced for status visibility only.
 */

export type GradeBatchRow = {
  id: string;
  offeringId: string;
  status: string;
  uploadedBy: string;
  publishedAt: string | null;
  createdAt: string;
  entryCount: number;
  publishedEntryCount: number;
};

export async function listGradeBatchesForClass(
  offeringIds: string[],
): Promise<GradeBatchRow[]> {
  if (offeringIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grade_batches")
    .select("id, offering_id, status, uploaded_by, published_at, created_at")
    .in("offering_id", offeringIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load grade batches", error.code);
  }

  const batches = data ?? [];

  if (batches.length === 0) {
    return [];
  }

  const { data: entryRows, error: entryError } = await supabase
    .from("grade_entries")
    .select("batch_id, published")
    .in(
      "batch_id",
      batches.map((row) => row.id),
    );

  if (entryError) {
    throw new DataAccessError("Could not count grade entries", entryError.code);
  }

  const totals = new Map<string, { total: number; published: number }>();

  for (const row of entryRows ?? []) {
    const bucket = totals.get(row.batch_id) ?? { total: 0, published: 0 };
    bucket.total += 1;
    if (row.published) {
      bucket.published += 1;
    }
    totals.set(row.batch_id, bucket);
  }

  return batches.map((row) => ({
    id: row.id,
    offeringId: row.offering_id,
    status: row.status,
    uploadedBy: row.uploaded_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    entryCount: totals.get(row.id)?.total ?? 0,
    publishedEntryCount: totals.get(row.id)?.published ?? 0,
  }));
}

export type GradeHistoryRow = {
  id: string;
  entryId: string;
  component: string | null;
  oldScore: number;
  newScore: number;
  changedBy: string;
  reason: string | null;
  changedAt: string;
};

/**
 * Recent grade changes for the class's batches. Entries are resolved for the
 * component label; scores are shown because the page is manage_grades-gated.
 */
export async function listGradeHistoryForClass(
  offeringIds: string[],
  limit = 50,
): Promise<GradeHistoryRow[]> {
  if (offeringIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data: batchRows, error: batchError } = await supabase
    .from("grade_batches")
    .select("id")
    .in("offering_id", offeringIds);

  if (batchError) {
    throw new DataAccessError("Could not load grade batches", batchError.code);
  }

  const batchIds = (batchRows ?? []).map((row) => row.id);

  if (batchIds.length === 0) {
    return [];
  }

  const { data: entryRows, error: entryError } = await supabase
    .from("grade_entries")
    .select("id, component")
    .in("batch_id", batchIds);

  if (entryError) {
    throw new DataAccessError("Could not load grade entries", entryError.code);
  }

  const componentByEntry = new Map(
    (entryRows ?? []).map((row) => [row.id, row.component]),
  );
  const entryIds = [...componentByEntry.keys()];

  if (entryIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("grade_history")
    .select(
      "id, entry_id, old_score, new_score, changed_by, reason, changed_at",
    )
    .in("entry_id", entryIds)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load grade history", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    entryId: row.entry_id,
    component: componentByEntry.get(row.entry_id) ?? null,
    oldScore: Number(row.old_score),
    newScore: Number(row.new_score),
    changedBy: row.changed_by,
    reason: row.reason,
    changedAt: row.changed_at,
  }));
}
