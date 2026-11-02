"use client";

import { Archive, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassDependencySummary } from "@starstask/contracts";

type DeleteClassButtonProps = {
  classSlug: string;
  name: string;
  classCode: string | null;
  academicYear: string;
  semester: string;
  dependencies: ClassDependencySummary;
};

/**
 * Deletes a class only when it has no academic history.
 *
 * The dialog repeats the class identity and its dependent counts before asking
 * for a typed code or name. When records exist, permanent deletion is refused
 * and archiving becomes the primary action so student work and attendance stay
 * intact.
 */
export function DeleteClassButton({
  classSlug,
  name,
  classCode,
  academicYear,
  semester,
  dependencies,
}: DeleteClassButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typedConfirm, setTypedConfirm] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const normalizedName = name.trim().toLowerCase();
  const expected = (classCode ?? name).trim().toLowerCase();
  const typed = typedConfirm.trim().toLowerCase();
  const isConfirmed =
    typed.length > 0 && (typed === expected || typed === normalizedName);

  const counts = [
    { label: "Members", value: dependencies.memberCount },
    { label: "Assignments", value: dependencies.assignmentCount },
    { label: "Submissions", value: dependencies.submissionCount },
    { label: "Sessions", value: dependencies.sessionCount },
    { label: "Attendance records", value: dependencies.attendanceCount },
    { label: "Schedule entries", value: dependencies.scheduleCount },
    { label: "Calendar events", value: dependencies.calendarEventCount },
    { label: "Leave requests", value: dependencies.leaveRequestCount },
    { label: "Subjects", value: dependencies.subjectCount },
    { label: "Invitations", value: dependencies.invitationCount },
  ].filter((count) => count.value > 0);

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typedConfirm.trim() }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not delete the class.");
        return;
      }

      router.push("/classes");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (isArchiving) {
      return;
    }

    setIsArchiving(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not archive the class.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          setTypedConfirm("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="danger"
          size="sm"
        >
          <Trash2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Delete class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete {name}?</DialogTitle>
        <DialogDescription>
          {dependencies.canDelete
            ? "This class has no members or academic records, so it can be deleted permanently. There is no undo."
            : "This class has records that belong to students. It cannot be deleted permanently; archive it instead so its history stays available."}
        </DialogDescription>

        <dl className="border-border mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
          <Detail
            label="Class code"
            value={classCode ?? "No code"}
          />
          <Detail
            label="Academic period"
            value={`${academicYear} · Semester ${semester}`}
          />
        </dl>

        {counts.length > 0 ? (
          <ul className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {counts.map((count) => (
              <li key={count.label}>
                {count.value} {count.label}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <Alert
            variant="error"
            className="mt-4"
          >
            {error}
          </Alert>
        ) : null}

        {dependencies.canDelete ? (
          <div className="mt-5 space-y-2">
            <Label htmlFor="delete-class-confirm">
              Type <span className="font-semibold">{classCode ?? name}</span>{" "}
              (or the class name) to confirm
            </Label>
            <Input
              id="delete-class-confirm"
              value={typedConfirm}
              autoComplete="off"
              onChange={(event) => setTypedConfirm(event.target.value)}
            />
          </div>
        ) : (
          <Alert
            variant="warning"
            className="mt-4"
          >
            <p className="font-medium">Archive keeps the history intact.</p>
            <p className="mt-1 text-xs">
              Members, assignments, submissions, attendance, schedules, and
              leave requests stay attached to this class and remain readable
              under the archive filter.
            </p>
          </Alert>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isDeleting || isArchiving}
          >
            Cancel
          </Button>

          {dependencies.canDelete ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleDelete()}
              disabled={!isConfirmed || isDeleting}
            >
              {isDeleting ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : null}
              Delete class permanently
            </Button>
          ) : dependencies.classStatus !== "archived" ? (
            <Button
              type="button"
              onClick={() => void handleArchive()}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <Archive
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              )}
              Archive class instead
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
