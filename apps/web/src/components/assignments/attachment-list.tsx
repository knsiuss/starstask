"use client";

import * as React from "react";

import { AttachmentAddDialog } from "@/components/assignments/attachment-add-dialog";
import { AttachmentDeleteDialog } from "@/components/assignments/attachment-delete-dialog";
import { AttachmentRenameDialog } from "@/components/assignments/attachment-rename-dialog";
import { AttachmentViewer } from "@/components/assignments/attachment-viewer";
import { AttachmentRow } from "@/components/assignments/detail/attachment-row";

export type AttachmentView = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string | null;
  downloadUrl: string | null;
};

type AttachmentListProps = {
  attachments: AttachmentView[];
  assignmentId?: string;
  canManage?: boolean;
};

export function AttachmentList({
  attachments,
  assignmentId,
  canManage = false,
}: AttachmentListProps) {
  const [viewerAttachment, setViewerAttachment] =
    React.useState<AttachmentView | null>(null);
  const [renameAttachment, setRenameAttachment] =
    React.useState<AttachmentView | null>(null);
  const [deleteAttachment, setDeleteAttachment] =
    React.useState<AttachmentView | null>(null);
  const canManageAttachments = canManage && Boolean(assignmentId);

  return (
    <div className="space-y-3">
      {canManageAttachments && assignmentId ? (
        <div className="flex justify-end">
          <AttachmentAddDialog
            assignmentId={assignmentId}
            attachmentCount={attachments.length}
          />
        </div>
      ) : null}

      {attachments.length === 0 ? (
        <div className="border-border bg-subtle text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          {canManageAttachments
            ? "No attachments yet. Add the brief, a diagram, or a reference file."
            : "No attachments have been added to this assignment."}
        </div>
      ) : (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              canManage={canManageAttachments}
              onView={() => setViewerAttachment(attachment)}
              onRename={() => setRenameAttachment(attachment)}
              onDelete={() => setDeleteAttachment(attachment)}
            />
          ))}
        </ul>
      )}

      {viewerAttachment ? (
        <AttachmentViewer
          key={viewerAttachment.id}
          attachment={viewerAttachment}
          onClose={() => setViewerAttachment(null)}
        />
      ) : null}

      {canManageAttachments && assignmentId && renameAttachment ? (
        <AttachmentRenameDialog
          key={renameAttachment.id}
          assignmentId={assignmentId}
          attachment={renameAttachment}
          onClose={() => setRenameAttachment(null)}
        />
      ) : null}

      {canManageAttachments && assignmentId && deleteAttachment ? (
        <AttachmentDeleteDialog
          key={deleteAttachment.id}
          assignmentId={assignmentId}
          attachment={deleteAttachment}
          onClose={() => setDeleteAttachment(null)}
        />
      ) : null}
    </div>
  );
}
