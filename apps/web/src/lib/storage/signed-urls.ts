import "server-only";

import type { AttachmentView } from "@/components/assignments/attachment-list";
import type { AssignmentAttachment } from "@/lib/db/assignments";
import {
  ATTACHMENT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/storage/attachments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Creates short-lived view and download URLs for attachments.
 *
 * The inline URL lets images render and PDFs open in the browser's viewer; the
 * download URL forces a file save. The bucket is private, and a signed URL only
 * succeeds when the storage policy lets the signed-in user read the assignment
 * or the submission under review.
 */
export async function getAttachmentViews(
  attachments: AssignmentAttachment[],
): Promise<AttachmentView[]> {
  if (attachments.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const bucket = supabase.storage.from(ATTACHMENT_BUCKET);

  return Promise.all(
    attachments.map(async (attachment) => {
      const [preview, download] = await Promise.all([
        bucket.createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS),
        bucket.createSignedUrl(
          attachment.storage_path,
          SIGNED_URL_TTL_SECONDS,
          { download: attachment.original_filename },
        ),
      ]);

      if (preview.error || download.error) {
        console.error("[storage] signed url failed", {
          code: preview.error?.name ?? download.error?.name,
        });
      }

      return {
        id: attachment.id,
        originalFilename: attachment.original_filename,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size,
        previewUrl: preview.data?.signedUrl ?? null,
        downloadUrl: download.data?.signedUrl ?? null,
      };
    }),
  );
}
