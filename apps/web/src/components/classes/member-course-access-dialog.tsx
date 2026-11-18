"use client";

import { BookLock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type SubjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type Props = {
  classSlug: string;
  member: { user_id: string; display_name: string } | null;
  onClose: () => void;
};

export function MemberCourseAccessDialog({
  classSlug,
  member,
  onClose,
}: Props) {
  const router = useRouter();
  const [loadedUserId, setLoadedUserId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([]);

  const loading = Boolean(member && loadedUserId !== member.user_id);

  React.useEffect(() => {
    if (!member) {
      return;
    }

    let cancelled = false;
    const targetId = member.user_id;

    fetch(
      `/api/classes/${classSlug}/members/courses?userId=${encodeURIComponent(targetId)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          data?: {
            scope?: "all" | "selected";
            subjectIds?: string[];
            subjects?: SubjectOption[];
          };
          error?: { message?: string };
        };

        if (!res.ok || !body.data) {
          throw new Error(
            body.error?.message ?? "Could not load course access settings.",
          );
        }

        return body.data;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setError(null);
        setScope(data.scope === "selected" ? "selected" : "all");
        setSelectedIds(data.subjectIds ?? []);
        setSubjects(data.subjects ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load course access settings.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedUserId(targetId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [classSlug, member]);

  const toggleSubject = (subjectId: string) => {
    setSelectedIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  };

  const save = async () => {
    if (!member || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/members/courses`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: member.user_id,
            scope,
            subjectIds: scope === "selected" ? selectedIds : [],
          }),
        },
      );

      if (!response.ok) {
        setError("Could not save course access.");
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={Boolean(member)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <span className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <BookLock
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div>
            <DialogTitle>Course access</DialogTitle>
            <DialogDescription>
              {member
                ? `Configure which courses ${member.display_name} can access and appear in for attendance.`
                : ""}
            </DialogDescription>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading courses...
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label className="border-border bg-subtle flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="courseScope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">All courses (Regular)</span>
                  <span className="text-muted-foreground block text-xs">
                    Access every course and appear on all attendance sheets.
                  </span>
                </span>
              </label>

              <label className="border-border bg-subtle flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="courseScope"
                  checked={scope === "selected"}
                  onChange={() => setScope("selected")}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">
                    Selected courses only (Retake)
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Other courses are locked and this student will not appear in
                    their attendance sheets.
                  </span>
                </span>
              </label>
            </div>

            {scope === "selected" ? (
              <div className="border-border space-y-1.5 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs font-medium">
                  Allowed courses
                </p>
                {subjects.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No courses in this class yet.
                  </p>
                ) : (
                  subjects.map((subject) => (
                    <label
                      key={subject.id}
                      className="hover:bg-subtle flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(subject.id)}
                        onChange={() => toggleSubject(subject.id)}
                      />
                      <span className="truncate">{subject.name}</span>
                      {subject.code ? (
                        <span className="text-muted-foreground font-mono text-xs">
                          {subject.code}
                        </span>
                      ) : null}
                    </label>
                  ))
                )}
              </div>
            ) : null}

            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="min-h-[44px]"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save access
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
