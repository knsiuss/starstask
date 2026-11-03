"use client";

import {
  Download,
  ExternalLink,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import * as React from "react";

import type { AttachmentView } from "@/components/assignments/attachment-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFileSize } from "@starstask/shared";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

type AttachmentViewerProps = {
  attachment: AttachmentView;
  onClose: () => void;
};

/** Larger preview with zoom and fullscreen for images and PDFs. */
export function AttachmentViewer({
  attachment,
  onClose,
}: AttachmentViewerProps) {
  const [zoom, setZoom] = React.useState(1);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const isImage = attachment.mimeType.startsWith("image/");
  const isPdf = attachment.mimeType === "application/pdf";

  const requestFullscreen = () => {
    const element = mediaRef.current;

    if (!element?.requestFullscreen) {
      return;
    }

    void element.requestFullscreen().catch(() => undefined);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col overflow-hidden p-0">
        <>
          <div className="border-border flex items-start gap-3 border-b px-4 py-3 pr-14">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">
                {attachment.originalFilename}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {attachment.mimeType} · {formatFileSize(attachment.fileSize)}
              </DialogDescription>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Zoom out"
                disabled={zoom <= MIN_ZOOM}
                onClick={() =>
                  setZoom((current) =>
                    Math.max(
                      MIN_ZOOM,
                      Number((current - ZOOM_STEP).toFixed(2)),
                    ),
                  )
                }
              >
                <Minus
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Button>
              <span className="text-muted-foreground w-12 text-center text-xs tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Zoom in"
                disabled={zoom >= MAX_ZOOM}
                onClick={() =>
                  setZoom((current) =>
                    Math.min(
                      MAX_ZOOM,
                      Number((current + ZOOM_STEP).toFixed(2)),
                    ),
                  )
                }
              >
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Reset zoom"
                disabled={zoom === 1}
                onClick={() => setZoom(1)}
              >
                <RotateCcw
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="View fullscreen"
                onClick={requestFullscreen}
              >
                <Maximize2
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Button>
            </div>
          </div>

          <div
            ref={mediaRef}
            className="bg-subtle flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-4"
          >
            {isImage && attachment.previewUrl ? (
              // The signed URL is private and short-lived, so the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.previewUrl}
                alt={attachment.originalFilename}
                style={{ transform: `scale(${zoom})` }}
                className="max-h-[calc(100dvh-12rem)] max-w-full origin-center object-contain transition-transform duration-150"
              />
            ) : isPdf && attachment.previewUrl ? (
              <iframe
                src={`${attachment.previewUrl}#view=FitH&zoom=${Math.round(zoom * 100)}`}
                title={`Preview of ${attachment.originalFilename}`}
                className="h-[calc(100dvh-14rem)] min-h-[240px] w-full rounded-md bg-white"
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                This preview is not available right now. Download the file
                instead.
              </p>
            )}
          </div>

          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              Preview links expire after 15 minutes.
            </p>
            <div className="flex items-center gap-2">
              {attachment.previewUrl ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                >
                  <a
                    href={attachment.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Open in new tab
                  </a>
                </Button>
              ) : null}
              {attachment.downloadUrl ? (
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                >
                  <a
                    href={attachment.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                    Download
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </>
      </DialogContent>
    </Dialog>
  );
}
