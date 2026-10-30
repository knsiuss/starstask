"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreateSubjectFormProps = {
  classSlug: string;
};

export function CreateSubjectForm({ classSlug }: CreateSubjectFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [lecturerName, setLecturerName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code || undefined,
          lecturerName: lecturerName || undefined,
          description: description || undefined,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not create subject.");
        return;
      }

      setName("");
      setCode("");
      setLecturerName("");
      setDescription("");
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
      >
        <Plus
          aria-hidden="true"
          className="h-4 w-4"
        />
        Add subject
      </Button>
    );
  }

  return (
    <div className="border-border bg-subtle mt-4 rounded-xl border p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">
          Create new subject / course
        </h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground rounded p-1"
          aria-label="Close form"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        This subject will automatically become available to all members of this class group.
      </p>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="subject-name">Subject name *</Label>
            <Input
              id="subject-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pemrograman Web"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="subject-code">Subject code (optional)</Label>
            <Input
              id="subject-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. IF201"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="subject-lecturer">Lecturer name (optional)</Label>
          <Input
            id="subject-lecturer"
            value={lecturerName}
            onChange={(e) => setLecturerName(e.target.value)}
            placeholder="e.g. Dr. Budi Santoso"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="subject-desc">Description (optional)</Label>
          <Textarea
            id="subject-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Overview of the course topics, grading criteria, etc."
            rows={2}
            className="mt-1 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isBusy || !name.trim()}
          >
            {isBusy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Create subject
          </Button>
        </div>
      </form>
    </div>
  );
}
