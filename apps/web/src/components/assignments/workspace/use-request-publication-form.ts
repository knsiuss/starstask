"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";
import type { WorkspaceClassOption } from "@/lib/db/assignment-workspace";

export function useRequestPublicationForm(classes: WorkspaceClassOption[]) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [classId, setClassId] = React.useState(classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = React.useState(
    classes[0]?.subjects[0]?.id ?? "",
  );
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadlineDate, setDeadlineDate] = React.useState("");
  const [deadlineTime, setDeadlineTime] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );

  const selected = classes.find((item) => item.id === classId);
  const selectedSubject = selected?.subjects.find((s) => s.id === subjectId);
  const publishesDirectly = selected?.is_admin === true;

  const deadlineIso = React.useMemo(() => {
    if (!deadlineDate) {
      return "";
    }

    const time = deadlineTime || "23:59";
    const parsed = new Date(`${deadlineDate}T${time}`);

    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [deadlineDate, deadlineTime]);

  const pickClass = (nextClassId: string) => {
    setClassId(nextClassId);
    const next = classes.find((item) => item.id === nextClassId);
    setSubjectId(next?.subjects[0]?.id ?? "");
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setDeadlineDate("");
    setDeadlineTime("");
    setFiles([]);
    setError(null);
    setFieldErrors({});
    pickClass(classes[0]?.id ?? "");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || !selected) {
      return;
    }

    const nextErrors: Record<string, string> = {};

    if (title.trim().length < 3) {
      nextErrors.title = "Title must be at least 3 characters";
    }

    if (description.trim().length < 10) {
      nextErrors.description = "Description must be at least 10 characters";
    }

    if (!subjectId) {
      nextErrors.subjectId = "Choose a course";
    }

    if (deadlineTime && !deadlineDate) {
      nextErrors.deadline = "Choose a deadline date first";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setError(null);
    setFieldErrors({});
    setIsSaving(true);

    const form = new FormData();
    form.set("title", title.trim());
    form.set("description", description.trim());
    form.set("contentType", "lecturer_assignment");
    form.set("subjectId", subjectId);

    if (deadlineIso) {
      form.set("deadline", deadlineIso);
    }

    for (const file of files) {
      form.append("files", file);
    }

    try {
      const response = await fetch(
        `/api/classes/${selected.slug}/submissions`,
        { method: "POST", body: form },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: { status?: string };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setError(
          body?.error?.message ??
            "The submission could not be saved. Try again.",
        );
        return;
      }

      toast({
        title:
          body?.data?.status === "published"
            ? "Assignment published"
            : "Publication requested",
        description:
          body?.data?.status === "published"
            ? "The assignment is now visible to class members."
            : "A class admin will review your request before it is published.",
      });
      setOpen(false);
      reset();
    } catch {
      setError("The submission could not be saved. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    open,
    setOpen,
    classId,
    subjectId,
    setSubjectId,
    title,
    setTitle,
    description,
    setDescription,
    deadlineDate,
    setDeadlineDate,
    deadlineTime,
    setDeadlineTime,
    files,
    setFiles,
    isSaving,
    error,
    fieldErrors,
    selected,
    selectedSubject,
    publishesDirectly,
    deadlineIso,
    pickClass,
    reset,
    submit,
  };
}
