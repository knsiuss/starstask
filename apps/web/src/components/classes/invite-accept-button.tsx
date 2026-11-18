"use client";

import { Check, Loader2 } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";

type InviteAcceptButtonProps = {
  token: string;
  label?: string;
};

type SubjectOption = {
  id: string;
  name: string;
  code: string | null;
};

/**
 * Redeems an invitation from the signed-in user's browser.
 *
 * When a class-wide invitation is accepted and the class has active courses,
 * opens a center modal so the user can pick the specific courses they teach or
 * follow before entering the class.
 */
export function InviteAcceptButton({
  token,
  label = "Join class",
}: InviteAcceptButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [joinedSlug, setJoinedSlug] = React.useState<string | null>(null);
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [savingCourses, setSavingCourses] = React.useState(false);
  const [courseError, setCourseError] = React.useState<string | null>(null);

  const goToClass = (slug: string | null) => {
    router.push(slug ? `/classes/${slug}` : "/app");
    router.refresh();
  };

  const accept = async () => {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/classes/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { slug: string | null; subjectId?: string | null };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not accept this invitation.");
        return;
      }

      const slug = body?.data?.slug ?? null;
      const subjectId = body?.data?.subjectId;

      if (slug && subjectId) {
        router.push(`/classes/${slug}/courses/${subjectId}`);
        router.refresh();
        return;
      }

      if (slug) {
        const courseRes = await fetch(
          `/api/classes/${slug}/members/me/courses`,
        );
        const courseBody = (await courseRes.json().catch(() => null)) as {
          data?: { subjects?: SubjectOption[] };
        } | null;
        const available = courseBody?.data?.subjects ?? [];

        if (available.length > 0) {
          setSubjects(available);
          setSelectedIds(available.map((item) => item.id));
          setJoinedSlug(slug);
          toast({
            variant: "success",
            title: "Joined class — select your courses",
          });
          return;
        }
      }

      goToClass(slug);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  };

  const saveSelection = async () => {
    if (!joinedSlug || savingCourses) {
      return;
    }

    if (selectedIds.length === 0) {
      setCourseError("Select at least one course, or choose Skip.");
      return;
    }

    setSavingCourses(true);
    setCourseError(null);

    try {
      const isAll = selectedIds.length === subjects.length;
      const response = await fetch(
        `/api/classes/${joinedSlug}/members/me/courses`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: isAll ? "all" : "selected",
            subjectIds: isAll ? [] : selectedIds,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setCourseError(
          body?.error?.message ?? "Could not save course selection.",
        );
        return;
      }

      toast({
        variant: "success",
        title: "Courses updated",
      });
      goToClass(joinedSlug);
    } catch {
      setCourseError("Network error. Check your connection and try again.");
    } finally {
      setSavingCourses(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button
          type="button"
          onClick={() => void accept()}
          disabled={isBusy}
          aria-busy={isBusy}
          className="w-full sm:w-auto"
        >
          {isBusy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {label}
        </Button>
      </div>

      <Dialog
        open={Boolean(joinedSlug)}
        onOpenChange={(open) => {
          if (!open && joinedSlug) {
            goToClass(joinedSlug);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Select your courses</DialogTitle>
          <DialogDescription>
            Choose the courses you teach or follow in this class. You can change
            this later.
          </DialogDescription>

          {courseError ? (
            <Alert
              variant="error"
              className="mt-3"
            >
              {courseError}
            </Alert>
          ) : null}

          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {subjects.map((subject) => {
              const checked = selectedIds.includes(subject.id);

              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => toggleSubject(subject.id)}
                  className="border-border hover:bg-muted/60 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {subject.name}
                    </span>
                    {subject.code ? (
                      <span className="text-muted-foreground block font-mono text-xs">
                        {subject.code}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      checked
                        ? "bg-accent text-accent-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded"
                        : "border-border flex h-5 w-5 shrink-0 items-center justify-center rounded border"
                    }
                  >
                    {checked ? (
                      <Check
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === subjects.length
                    ? []
                    : subjects.map((item) => item.id),
                )
              }
              disabled={savingCourses}
            >
              {selectedIds.length === subjects.length
                ? "Clear all"
                : "Select all"}
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => goToClass(joinedSlug)}
                disabled={savingCourses}
              >
                Skip
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void saveSelection()}
                disabled={savingCourses}
              >
                {savingCourses ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : null}
                Save & continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
