"use client";

import { isSafeHttpUrl } from "@starstask/contracts";

import type { ToastOptions } from "@/components/ui/toast";

const ASYNC_POLL_INTERVAL_MS = 2_000;
const ASYNC_POLL_ATTEMPTS = 15;

type ToastFn = (options: ToastOptions) => string;

function isSafeDownloadUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !value.includes("\\");
  }

  return isSafeHttpUrl(value);
}

function triggerAnchorDownload(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";

  if (filename) {
    anchor.download = filename;
  } else {
    anchor.download = "";
  }

  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Triggers an attendance export download without `window.open` so async
 * polling completions are never blocked by browser popup blockers, and
 * surfaces a clickable fallback download link inside the completion toast.
 */
export async function runAttendanceExport(options: {
  href: string;
  fallbackFilename: (blob: Blob) => string;
  toast: ToastFn;
}): Promise<void> {
  const separator = options.href.includes("?") ? "&" : "?";
  const response = await fetch(`${options.href}${separator}async=1`);

  if (response.ok && response.status === 202) {
    const body = (await response.json()) as { data?: { jobId?: string } };
    const jobId = body.data?.jobId;

    if (!jobId) {
      throw new Error("Export queue is not available");
    }

    options.toast({ title: "Export queued. Preparing your file..." });

    for (let attempt = 0; attempt < ASYNC_POLL_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, ASYNC_POLL_INTERVAL_MS),
      );
      const status = await fetch(`/api/exports/${jobId}`);

      if (!status.ok) {
        continue;
      }

      const job = (await status.json()) as {
        data?: { status?: string; downloadUrl?: string | null };
      };
      const downloadUrl = job.data?.downloadUrl;

      if (job.data?.status === "done" && downloadUrl) {
        if (!isSafeDownloadUrl(downloadUrl)) {
          throw new Error("Export returned an invalid download URL");
        }

        triggerAnchorDownload(downloadUrl);
        options.toast({
          variant: "success",
          title: "Export ready",
          description:
            "If the download did not start automatically, use the link below.",
          duration: 15_000,
          content: (
            <a
              href={downloadUrl}
              download
              rel="noopener noreferrer"
              className="text-accent focus-visible:outline-accent mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Download file
            </a>
          ),
        });

        return;
      }

      if (job.data?.status === "failed") {
        throw new Error("Export failed in the background");
      }
    }

    throw new Error("Export is taking longer than expected");
  }

  if (response.ok) {
    // Sync fallback (async disabled server-side): trigger file download.
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename = match?.[1] ?? options.fallbackFilename(blob);
    const url = URL.createObjectURL(blob);

    triggerAnchorDownload(url, filename);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    return;
  }

  throw new Error("Export failed");
}
