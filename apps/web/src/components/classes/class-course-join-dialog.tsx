"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { ClassLookupMatch } from "@/app/api/classes/lookup/route";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type ClassCourseJoinDialogProps = {
  matches: ClassLookupMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAnyway?: () => void;
};

/**
 * Center modal shown when an existing class is found during Join or Create.
 * Lets the lecturer inspect the matched class and choose specific courses
 * before joining (never auto-creates or auto-joins without course choice).
 */
export function ClassCourseJoinDialog({
  matches,
  open,
  onOpenChange,
  onCreateAnyway,
}: ClassCourseJoinDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [prevMatches, setPrevMatches] =
    React.useState<ClassLookupMatch[]>(matches);
  const [selectedClassId, setSelectedClassId] = React.useState<string>(
    () => matches[0]?.id ?? "",
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>(
    () => matches[0]?.subjects.map((subject) => subject.id) ?? [],
  );
  const [isJoining, setIsJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (matches !== prevMatches) {
    setPrevMatches(matches);
    const first = matches[0];
    setSelectedClassId(first?.id ?? "");
    setSelectedSubjectIds(first?.subjects.map((subject) => subject.id) ?? []);
    setError(null);
  }

  const activeClass =
    matches.find((item) => item.id === selectedClassId) ?? matches[0] ?? null;

  const handleSelectClass = (next: ClassLookupMatch) => {
    setSelectedClassId(next.id);
    setSelectedSubjectIds(next.subjects.map((subject) => subject.id));
    setError(null);
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  };

  const confirmJoin = async () => {
    if (!activeClass || isJoining) {
      return;
    }

    if (activeClass.subjects.length > 0 && selectedSubjectIds.length === 0) {
      setError("Select at least one course to join.");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      if (!activeClass.isMember) {
        const joinRes = await fetch("/api/classes/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ className: activeClass.slug }),
        });

        const joinBody = (await joinRes.json().catch(() => null)) as {
          data?: { result?: { status?: string; reason?: string } };
          error?: { message?: string };
        } | null;

        if (!joinRes.ok) {
          setError(joinBody?.error?.message ?? "Could not join this class.");
          return;
        }

        const resultStatus = joinBody?.data?.result?.status;

        if (resultStatus === "invitation_required") {
          setError(
            "This class requires an invitation link from the class admin.",
          );
          return;
        }

        if (resultStatus !== "joined" && resultStatus !== "already_member") {
          setError(
            joinBody?.data?.result?.reason ?? "Could not join this class.",
          );
          return;
        }
      }

      if (activeClass.subjects.length > 0) {
        const isAll = selectedSubjectIds.length === activeClass.subjects.length;
        const courseRes = await fetch(
          `/api/classes/${activeClass.slug}/members/me/courses`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scope: isAll ? "all" : "selected",
              subjectIds: isAll ? [] : selectedSubjectIds,
            }),
          },
        );

        if (!courseRes.ok) {
          const courseBody = (await courseRes.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          setError(
            courseBody?.error?.message ??
              "Joined class, but could not save course selection.",
          );
          return;
        }
      }

      toast({
        variant: "success",
        title: `Joined ${activeClass.name}`,
      });
      onOpenChange(false);
      router.push(`/classes/${activeClass.slug}`);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsJoining(false);
    }
  };

  if (!activeClass) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogTitle>Existing class found</DialogTitle>
        <DialogDescription>
          Choose the class and courses you want to join before continuing.
        </DialogDescription>

        {error ? (
          <Alert
            variant="error"
            className="mt-3"
          >
            {error}
          </Alert>
        ) : null}

        {matches.length > 1 ? (
          <div className="mt-4 space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">
              Matching classes
            </p>
            <div className="flex flex-wrap gap-2">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectClass(item)}
                  className={
                    item.id === activeClass.id
                      ? "border-accent bg-accent-soft text-accent rounded-md border px-2.5 py-1 text-xs font-medium"
                      : "border-border bg-background text-muted-foreground hover:text-foreground rounded-md border px-2.5 py-1 text-xs font-medium"
                  }
                >
                  {item.name} ({item.academicYear})
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-border bg-muted/40 mt-4 rounded-lg border px-3 py-2.5">
          <p className="text-sm font-semibold">{activeClass.name}</p>
          <p className="text-muted-foreground text-xs">
            {activeClass.semester} · {activeClass.academicYear}
            {activeClass.isMember ? " · Already a member" : ""}
          </p>
        </div>

        {activeClass.subjects.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium">Select courses to join</p>
              <button
                type="button"
                onClick={() =>
                  setSelectedSubjectIds(
                    selectedSubjectIds.length === activeClass.subjects.length
                      ? []
                      : activeClass.subjects.map((subject) => subject.id),
                  )
                }
                className="text-accent text-xs font-medium hover:underline"
              >
                {selectedSubjectIds.length === activeClass.subjects.length
                  ? "Clear all"
                  : "Select all"}
              </button>
            </div>

            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {activeClass.subjects.map((subject) => {
                const checked = selectedSubjectIds.includes(subject.id);

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className="border-border hover:bg-muted/60 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
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
          </div>
        ) : (
          <p className="text-muted-foreground mt-4 text-xs">
            This class has no courses listed yet. You can add courses after
            joining.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {onCreateAnyway ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCreateAnyway}
              disabled={isJoining}
            >
              Create new anyway
            </Button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmJoin()}
              disabled={isJoining}
            >
              {isJoining ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : null}
              {activeClass.isMember ? "Save courses" : "Join & save courses"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
