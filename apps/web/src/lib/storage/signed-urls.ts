import "server-only";

import type { AttachmentView } from "@/components/assignments/attachment-list";
import type { AssignmentAttachment } from "@/lib/db/assignments";
import { signStorageUrl } from "@/lib/storage/b2";

/**
 * Creates short-lived view and download URLs for attachments.
 *
 * Each object is signed on whichever backend holds it (B2/R2 or Supabase);
 * the bucket is private in all of them, and a signed URL only succeeds when
 * the storage policy lets the signed-in user read the assignment or the
 * submission under review.
 */
export async function getAttachmentViews(
  attachments: AssignmentAttachment[],
): Promise<AttachmentView[]> {
  if (attachments.length === 0) {
    return [];
  }

  return Promise.all(
    attachments.map(async (attachment) => {
      const provider = attachment.storage_provider ?? "supabase";

      const [preview, download] = await Promise.all([
        signStorageUrl(provider, attachment.storage_path).catch(() => null),
        signStorageUrl(provider, attachment.storage_path, {
          download: attachment.original_filename,
        }).catch(() => null),
      ]);

      if (!preview || !download) {
        console.error("[storage] signed url failed", { provider });
      }

      return {
        id: attachment.id,
        originalFilename: attachment.original_filename,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size,
        previewUrl: preview,
        downloadUrl: download,
      };
    }),
  );
}
