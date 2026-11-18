"server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ExportJobStatus = "pending" | "running" | "done" | "failed";

export type ExportJob = {
  id: string;
  user_id: string;
  kind: string;
  params: Record<string, unknown>;
  status: ExportJobStatus;
  result_path: string | null;
  error_category: string | null;
  created_at: string;
  updated_at: string;
};

/** Creates a job row owned by the caller (RLS owner policy applies). */
export async function createExportJob(input: {
  userId: string;
  kind: string;
  params: Record<string, unknown>;
}): Promise<ExportJob> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("export_jobs" as never)
    .insert({
      user_id: input.userId,
      kind: input.kind,
      params: input.params,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Could not queue the export.");
  }

  return data as ExportJob;
}

/** Owner-scoped read for the polling endpoint. */
export async function getOwnExportJob(
  jobId: string,
  userId: string,
): Promise<ExportJob | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("export_jobs" as never)
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data as ExportJob | null) ?? null;
}

/** Worker read: service role, no auth identity needed (QStash-signed). */
export async function getExportJobForWorker(
  jobId: string,
): Promise<ExportJob | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("export_jobs" as never)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!data) return null;

  const row = data as ExportJob;

  if (row.status === "done" || row.status === "failed") {
    return null; // Idempotent: finished jobs never run twice.
  }

  await supabase
    .from("export_jobs" as never)
    .update({
      status: "running",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", jobId);

  return row;
}

export async function markExportJobDone(
  jobId: string,
  resultPath: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("export_jobs" as never)
    .update({
      status: "done",
      result_path: resultPath,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", jobId);
}

export async function markExportJobFailed(
  jobId: string,
  errorCategory: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("export_jobs" as never)
    .update({
      status: "failed",
      error_category: errorCategory,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", jobId);
}
