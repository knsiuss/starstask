import Link from "next/link";

import { DriveSubmit } from "@/components/assignments/drive-submit";
import { Button } from "@/components/ui/button";

export function AssignmentDetailExtras({
  assignmentId,
  isOwner,
  isPublished,
  driveClientId,
}: {
  assignmentId: string;
  isOwner: boolean;
  isPublished: boolean;
  driveClientId: string;
}) {
  if (isOwner) {
    return null;
  }

  return (
    <>
      {isPublished ? (
        <section
          aria-labelledby="drive-submit-heading"
          className="border-border bg-surface rounded-xl border p-5"
        >
          <h2
            id="drive-submit-heading"
            className="text-foreground text-sm font-semibold"
          >
            Submit your work via Google Drive
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Pick a file from your own Drive. We copy it at submission time and
            give you a lecturer link to forward. Your lecturer does not need a
            StarsTask account.
          </p>
          <div className="mt-3.5">
            <DriveSubmit
              assignmentId={assignmentId}
              clientId={driveClientId}
            />
          </div>
        </section>
      ) : null}

      <div className="border-border bg-subtle flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:px-5">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">
            Have additional assignment materials?
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Help your classmates by contributing useful information.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="min-h-[44px] w-full shrink-0 sm:min-h-8 sm:w-auto"
        >
          <Link href="/submit">Contribute</Link>
        </Button>
      </div>
    </>
  );
}
