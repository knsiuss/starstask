"server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DriveSubmissionRow = {
  id: string;
  assignment_id: string;
  user_id: string;
  drive_file_id: string | null;
  drive_file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  storage_provider: string;
  source: string;
  share_token: string;
  created_at: string;
  updated_at: string;
};

export type InsertDriveSubmissionInput = {
  assignmentId: string;
  userId: string;
  driveFileId: string | null;
  driveFileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  storageProvider: string;
  source: "google_drive" | "upload";
};

/** Inserts via the user-scoped client so RLS owner policy applies. */
export async function insertDriveSubmission(
  input: InsertDriveSubmissionInput,
): Promise<DriveSubmissionRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("drive_submissions" as never)
    .insert({
      assignment_id: input.assignmentId,
      user_id: input.userId,
      drive_file_id: input.driveFileId,
      drive_file_name: input.driveFileName,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
      storage_provider: input.storageProvider,
      source: input.source,
      share_token: randomUUID(),
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Could not save the submission.");
  }

  return data as DriveSubmissionRow;
}

/** Lecturer lookup by share token. Service role: no login required. */
export async function getDriveSubmissionByToken(
  token: string,
): Promise<DriveSubmissionRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("drive_submissions" as never)
    .select("*")
    .eq("share_token", token)
    .maybeSingle();

  return (data as DriveSubmissionRow | null) ?? null;
}

export async function listMyDriveSubmissions(
  userId: string,
  assignmentId: string,
): Promise<DriveSubmissionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("drive_submissions" as never)
    .select("*")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });

  return (data ?? []) as DriveSubmissionRow[];
}
