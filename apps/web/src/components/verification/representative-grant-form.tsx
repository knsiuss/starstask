"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { representativeGrantSchema } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type GrantableClass = {
  id: string;
  name: string;
  semester: string;
  academicYear: string;
};

type GrantResponse = {
  data?: { granted?: boolean; alreadyRepresentative?: boolean };
  error?: { message?: string };
};

/**
 * Temporary direct grant (while verification review is disabled).
 *
 * The student picks one of their active classes and becomes its class
 * representative immediately; the server enforces the 5-per-class cap.
 */
export function RepresentativeGrantForm({
  classes,
}: {
  classes: GrantableClass[];
}) {
  const router = useRouter();
  const [classId, setClassId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError(null);
    setMessage(null);

    const parsed = representativeGrantSchema.safeParse({ classId });

    if (!parsed.success) {
      setError("Choose the class you represent.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/verification/representative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response
        .json()
        .catch(() => null)) as GrantResponse | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save your request.");
        return;
      }

      if (body?.data?.alreadyRepresentative) {
        setMessage("You are already the representative of this class.");
        return;
      }

      setMessage("You now have class representative access for this class.");
      setClassId("");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={grant}
      noValidate
      className="border-border bg-surface rounded-xl border p-5"
    >
      <div className="flex items-start gap-3">
        <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <ShieldCheck
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>
        <div>
          <h3 className="text-base font-semibold">
            Become a class representative
          </h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Pick the class you represent. This grants class admin access for
            that class right away — at most 5 representatives per class.
          </p>
        </div>
      </div>

      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          {message}
        </Alert>
      ) : null}

      <div className="mt-4 max-w-sm space-y-1.5">
        <Label htmlFor="representative-class">Class</Label>
        <Select
          id="representative-class"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          disabled={busy || classes.length === 0}
        >
          <option value="">Choose a class</option>
          {classes.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.name} · {item.semester} {item.academicYear}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={busy || classId === ""}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <ShieldCheck
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Become representative
        </Button>
        <span className="text-muted-foreground text-xs">
          You must already be a member of the class.
        </span>
      </div>
    </form>
  );
}
