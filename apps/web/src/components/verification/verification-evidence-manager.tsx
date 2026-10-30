"use client";

import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { VERIFICATION_EVIDENCE_MAX_FILES } from "@starstask/contracts";
import { formatFileSize } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { VerificationEvidenceDownload } from "@/features/verification/evidence-service";

/**
 * Evidence list and uploader for one request.
 *
 * Files are shown by display name and size only. The storage key never reaches
 * the browser, and downloads use short-lived signed URLs created on the server.
 */
export function VerificationEvidenceManager({
  requestId,
  views,
  editable,
}: {
  requestId: string;
  views: VerificationEvidenceDownload[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const atLimit = views.length >= VERIFICATION_EVIDENCE_MAX_FILES;

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(
        `/api/verification/requests/${requestId}/evidence`,
        { method: "POST", body },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(payload?.error?.message ?? "Could not upload the file.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function onRemove(evidenceId: string) {
    setRemoving(evidenceId);
    setError(null);

    try {
      const response = await fetch(
        `/api/verification/requests/${requestId}/evidence/${evidenceId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(payload?.error?.message ?? "Could not remove the file.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="grid gap-3">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {views.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No supporting documents yet. At least one is required before the
          request can be submitted.
        </p>
      ) : (
        <ul className="grid gap-2">
          {views.map((item) => (
            <li
              key={item.id}
              className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.originalFilename}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFileSize(item.fileSize)} ·{" "}
                    {item.mimeType === "application/pdf"
                      ? "PDF"
                      : item.mimeType === "image/png"
                        ? "PNG"
                        : "JPG"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.signedUrl ? (
                  <a
                    href={item.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent text-sm underline-offset-4 hover:underline"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Unavailable
                  </span>
                )}

                {editable ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onRemove(item.id)}
                    disabled={removing === item.id}
                    aria-label={`Remove ${item.originalFilename}`}
                  >
                    {removing === item.id ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <Trash2
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    )}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editable && !atLimit ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => void onUpload(event)}
            disabled={busy}
            className="text-muted-foreground file:border-border file:bg-muted file:text-foreground hover:file:bg-muted/70 w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
            aria-label="Upload supporting document"
          />
          <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
            <Upload
              aria-hidden="true"
              className="h-3 w-3"
            />
            PDF, JPG, or PNG · up to 10 MB each · at most{" "}
            {VERIFICATION_EVIDENCE_MAX_FILES} files
            {busy ? " · uploading…" : ""}
          </p>
        </div>
      ) : null}

      {editable && atLimit ? (
        <p className="text-muted-foreground text-xs">
          You have attached the maximum of {VERIFICATION_EVIDENCE_MAX_FILES}{" "}
          files. Remove one to upload another.
        </p>
      ) : null}
    </div>
  );
}
