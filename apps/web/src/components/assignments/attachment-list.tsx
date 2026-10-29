import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react";

import { formatFileSize } from "@starstask/shared";

export type AttachmentView = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string | null;
};

type AttachmentListProps = {
  attachments: AttachmentView[];
};

export function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ul className="divide-border border-border divide-y rounded-md border">
      {attachments.map((attachment) => {
        const Icon = iconForMime(attachment.mimeType);

        return (
          <li
            key={attachment.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
          >
            <Icon
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4 shrink-0"
            />
            <span className="min-w-0 flex-1 truncate">
              {attachment.originalFilename}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatFileSize(attachment.fileSize)}
            </span>
            {attachment.signedUrl ? (
              <a
                href={attachment.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent focus-visible:outline-accent inline-flex items-center gap-1 rounded-sm text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Download
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Download
              </a>
            ) : (
              <span className="text-muted-foreground text-xs">Unavailable</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function iconForMime(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return FileImage;
  }

  if (mimeType.includes("spreadsheet")) {
    return FileSpreadsheet;
  }

  if (mimeType.includes("presentation")) {
    return Presentation;
  }

  return FileText;
}
