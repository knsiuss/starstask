import { Browser } from "@capacitor/browser";

import { getSupabase } from "./supabase";

/**
 * Open a stored attachment outside the WebView.
 *
 * Attachments live in a private bucket, so a short-lived signed URL is
 * minted on the server side of the SDK (user JWT) and opened in a Custom
 * Tab — the WebView never navigates away from the app.
 */

const SIGNED_URL_TTL_SECONDS = 15 * 60;

export async function openAttachment(storagePath: string): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  const { data, error } = await supabase.storage
    .from("assignment-attachments")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not open the attachment.");
  }

  await Browser.open({ url: data.signedUrl });
}

export type AttachmentRef = {
  id: string;
  filename: string;
  storagePath: string;
};

export async function listAttachments(
  assignmentId: string,
): Promise<AttachmentRef[]> {
  const supabase = getSupabase();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("assignment_attachments")
    .select("id, original_filename, storage_path")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  return (
    (data ?? []) as Array<{
      id: string;
      original_filename: string;
      storage_path: string;
    }>
  ).map((row) => ({
    id: row.id,
    filename: row.original_filename,
    storagePath: row.storage_path,
  }));
}
