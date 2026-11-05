"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AcademicYearFormProps = {
  universityId: string;
};

/**
 * Platform-admin form for creating an academic year. Client-side validation
 * is a courtesy; the route re-validates with the same Zod schema.
 */
export function AcademicYearForm({ universityId }: AcademicYearFormProps) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [isCurrent, setIsCurrent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId,
          code,
          name,
          startDate,
          endDate,
          isCurrent,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Could not create the academic year.",
        );
      }

      setSuccess("Academic year created.");
      setCode("");
      setName("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ay-code">Code</Label>
          <Input
            id="ay-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="2026/2027"
            required
            maxLength={40}
          />
        </div>
        <div>
          <Label htmlFor="ay-name">Name</Label>
          <Input
            id="ay-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Academic Year 2026/2027"
            required
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="ay-start">Start</Label>
          <Input
            id="ay-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="ay-end">End</Label>
          <Input
            id="ay-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isCurrent}
          onChange={(event) => setIsCurrent(event.target.checked)}
        />
        Mark as the current academic year (replaces the previous one)
      </label>

      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {success ? <p className="text-success text-sm">{success}</p> : null}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
      >
        {pending ? "Creating…" : "Create academic year"}
      </Button>
    </form>
  );
}
