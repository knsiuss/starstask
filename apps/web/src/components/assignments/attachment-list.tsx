"use client";

import {
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Presentation,
  Trash2,
} from "lucide-react";
import * as React from "react";

import { AttachmentAddDialog } from "@/components/assignments/attachment-add-dialog";
import { AttachmentDeleteDialog } from "@/components/assignments/attachment-delete-dialog";
import { AttachmentRenameDialog } from "@/components/assignments/attachment-rename-dialog";
import { AttachmentViewer } from "@/components/assignments/attachment-viewer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isInlinePreviewable } from "@/lib/storage/attachment-preview";
import { formatFileSize } from "@starstask/shared";

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
          No attachments yet. Add the brief, a diagram, or a reference file.
        </div>
      ) : (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
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

type AttachmentRowProps = {
  attachment: AttachmentView;
  canManage: boolean;
  onView: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function AttachmentRow({
  attachment,
  canManage,
  onView,
  onRename,
  onDelete,
}: AttachmentRowProps) {
  const canPreview = Boolean(
    attachment.previewUrl && isInlinePreviewable(attachment.mimeType),
  );

  return (
    <li className="min-w-0">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <span
          aria-hidden="true"
          className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <AttachmentIcon mimeType={attachment.mimeType} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">
            {attachment.originalFilename}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {fileTypeLabel(attachment.originalFilename, attachment.mimeType)} ·{" "}
            {formatFileSize(attachment.fileSize)}
          </p>
        </div>

        <AttachmentActions
          attachment={attachment}
          canManage={canManage}
          canPreview={canPreview}
          onView={onView}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>

      {canPreview ? (
        <AttachmentInlinePreview
          attachment={attachment}
          onExpand={onView}
        />
      ) : null}
    </li>
  );
}

type AttachmentActionsProps = {
  attachment: AttachmentView;
  canManage: boolean;
  canPreview: boolean;
  onView: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function AttachmentActions({
  attachment,
  canManage,
  canPreview,
  onView,
  onRename,
  onDelete,
}: AttachmentActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          aria-label={`Actions for ${attachment.originalFilename}`}
        >
          <MoreHorizontal
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPreview ? (
          <DropdownMenuItem
            onSelect={onView}
            className="flex items-center gap-2"
          >
            <Eye
              aria-hidden="true"
              className="h-4 w-4"
            />
            View
          </DropdownMenuItem>
        ) : null}

        {attachment.downloadUrl ? (
          <DropdownMenuItem
            asChild
            className="flex items-center gap-2"
          >
            <a
              href={attachment.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Download ${attachment.originalFilename}`}
            >
              <Download
                aria-hidden="true"
                className="h-4 w-4"
              />
              Download
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled
            className="flex items-center gap-2"
          >
            <Download
              aria-hidden="true"
              className="h-4 w-4"
            />
            Download unavailable
          </DropdownMenuItem>
        )}

        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onRename}
              className="flex items-center gap-2"
            >
              <Pencil
                aria-hidden="true"
                className="h-4 w-4"
              />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-danger data-[highlighted]:bg-danger-soft flex items-center gap-2"
            >
              <Trash2
                aria-hidden="true"
                className="h-4 w-4"
              />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type AttachmentInlinePreviewProps = {
  attachment: AttachmentView;
  onExpand: () => void;
};

function AttachmentInlinePreview({
  attachment,
  onExpand,
}: AttachmentInlinePreviewProps) {
  if (!attachment.previewUrl) {
    return null;
  }

  return (
    <div className="border-border bg-subtle border-t p-3">
      <div className="border-border bg-surface relative overflow-hidden rounded-lg border">
        {attachment.mimeType.startsWith("image/") ? (
          <button
            type="button"
            onClick={onExpand}
            className="focus-visible:outline-accent block w-full focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`Open a larger preview of ${attachment.originalFilename}`}
          >
            {/* The signed URL is private and short-lived, so the optimizer adds no value. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.previewUrl}
              alt={attachment.originalFilename}
              loading="lazy"
              decoding="async"
              className="mx-auto max-h-[240px] w-full object-contain"
            />
          </button>
        ) : (
          <iframe
            src={`${attachment.previewUrl}#view=FitH`}
            title={`Preview of ${attachment.originalFilename}`}
            loading="lazy"
            className="pointer-events-none h-[240px] w-full"
          />
        )}

        <button
          type="button"
          onClick={onExpand}
          aria-label={`Expand preview of ${attachment.originalFilename}`}
          className="border-border bg-surface/95 text-foreground hover:bg-muted focus-visible:outline-accent absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md border shadow-sm backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Maximize2
            aria-hidden="true"
            className="h-4 w-4"
          />
        </button>
      </div>
    </div>
  );
}

function fileTypeLabel(filename: string, mimeType: string): string {
  const extension = filename.split(".").pop();

  if (extension && extension.length <= 5) {
    return extension.toUpperCase();
  }

  return mimeType.split("/").pop()?.toUpperCase() ?? "FILE";
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  const className = "h-5 w-5";

  if (mimeType.startsWith("image/")) {
    return (
      <FileImage
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (mimeType.includes("spreadsheet")) {
    return (
      <FileSpreadsheet
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (mimeType.includes("presentation")) {
    return (
      <Presentation
        aria-hidden="true"
        className={className}
      />
    );
  }

  return (
    <FileText
      aria-hidden="true"
      className={className}
    />
  );
}
