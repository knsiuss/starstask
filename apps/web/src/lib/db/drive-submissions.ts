"server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

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
  share_expires_at: string | null;
  share_revoked_at: string | null;
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

/** Share links live 30 days: long enough for a lecturer review cycle. */
const SHARE_TTL_DAYS = 30;

/** 256-bit bearer credential; only its SHA-256 hex is ever stored. */
function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

async function hashShareToken(token: string): Promise<string> {
  const digest = createHash("sha256").update(token, "utf8").digest("hex");

  return digest;
}

/** Inserts via the user-scoped client so RLS owner policy applies. */
export async function insertDriveSubmission(
  input: InsertDriveSubmissionInput,
): Promise<{ row: DriveSubmissionRow; shareToken: string }> {
  const supabase = await createSupabaseServerClient();
  const shareToken = generateShareToken();
  const shareTokenHash = await hashShareToken(shareToken);
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000);

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
      share_token_hash: shareTokenHash,
      share_expires_at: expiresAt.toISOString(),
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Could not save the submission.");
  }

  return { row: data as DriveSubmissionRow, shareToken };
}

/** Lecturer lookup by hashed share token. Service role: no login required. */
export async function getDriveSubmissionByToken(
  token: string,
): Promise<DriveSubmissionRow | null> {
  const supabase = createSupabaseAdminClient();
  const tokenHash = await hashShareToken(token);
  const { data } = await supabase
    .from("drive_submissions" as never)
    .select("*")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();

  const row = (data as DriveSubmissionRow | null) ?? null;

  if (!row || row.share_revoked_at) {
    return null;
  }

  if (row.share_expires_at && new Date(row.share_expires_at) <= new Date()) {
    return null;
  }

  return row;
}

/** Revokes the share link of one of the caller's own submissions. */
export async function revokeDriveSubmission(
  submissionId: string,
  userId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("drive_submissions" as never)
    .update({ share_revoked_at: new Date().toISOString() } as never)
    .eq("id", submissionId)
    .eq("user_id", userId)
    .is("share_revoked_at", null);

  if (error) {
    throw new Error("Could not revoke the share link.");
  }
}

/** Constant-time comparison, for contexts without indexed lookup. */
export function shareTokenDigestsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
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
