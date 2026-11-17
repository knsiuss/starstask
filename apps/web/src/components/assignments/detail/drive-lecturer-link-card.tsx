"use client";

import { Check, Link2, Loader2 } from "lucide-react";

import { CopyLinkButton } from "@/components/assignments/copy-link-button";
import { Button } from "@/components/ui/button";

export function DriveLecturerLinkCard({
  lecturerUrl,
  submissionId,
  revoking,
  onRevoke,
}: {
  lecturerUrl: string;
  submissionId: string | null;
  revoking: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className="border-border bg-subtle rounded-lg border p-3.5">
      <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
        <Check
          aria-hidden="true"
          className="text-success h-4 w-4 shrink-0"
        />
        Ready for your lecturer
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Forward this link. Your lecturer does not need a StarsTask account.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyLinkButton url={lecturerUrl} />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-[44px] px-3 sm:min-h-8"
        >
          <a
            href={lecturerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Link2
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Open lecturer view
          </a>
        </Button>
        {submissionId ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRevoke}
            disabled={revoking}
            aria-busy={revoking}
            className="min-h-[44px] px-3 sm:min-h-8"
          >
            {revoking ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Revoke link
          </Button>
        ) : null}
      </div>
    </div>
  );
}
