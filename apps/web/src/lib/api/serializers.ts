import "server-only";

import type { AssignmentDetail } from "@/lib/db/assignments";

export type PublicAttachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

export type PublicAssignment = Omit<
  AssignmentDetail,
  "user_id" | "attachments"
> & {
  attachments: PublicAttachment[];
};

/**
 * Drops fields that only the server needs: the owner's auth id and the
 * internal storage key. Download URLs are issued per request instead of
 * being embedded in a cacheable API payload.
 */
export function toPublicAssignment(detail: AssignmentDetail): PublicAssignment {
  const { user_id: _ownerId, attachments, ...rest } = detail;

  return {
    ...rest,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      originalFilename: attachment.original_filename,
      mimeType: attachment.mime_type,
      fileSize: attachment.file_size,
    })),
  };
}
