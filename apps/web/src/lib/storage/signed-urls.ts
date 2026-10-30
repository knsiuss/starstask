import "server-only";

import type { AttachmentView } from "@/components/assignments/attachment-list";
import type { AssignmentAttachment } from "@/lib/db/assignments";
import {
  ATTACHMENT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/storage/attachments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Creates short-lived download URLs for attachments.
 *
 * The bucket is private. The signed URL only succeeds when the storage policy
 * lets the signed-in user read the assignment or its attachments for review.
 */
export async function getAttachmentViews(
  attachments: AssignmentAttachment[],
): Promise<AttachmentView[]> {
  if (attachments.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  return Promise.all(
    attachments.map(async (attachment) => {
      const { data, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS, {
          download: attachment.original_filename,
        });

      if (error) {
        console.error("[storage] signed url failed", { code: error.name });
      }

      return {
        id: attachment.id,
        originalFilename: attachment.original_filename,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
}
