"use client";

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  DECLARED_POSITION_LABELS,
  DECLARED_POSITIONS,
  declaredPositionUpdateSchema,
  type DeclaredPosition,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * Records what the student says they are.
 *
 * The value is a claim shown on the profile. It is stored separately from
 * roles, and no authorization check reads it.
 */
export function PositionForm({
  initialPosition,
}: {
  initialPosition: DeclaredPosition;
}) {
  const router = useRouter();
  const [selected, setSelected] =
    React.useState<DeclaredPosition>(initialPosition);
  const [saved, setSaved] = React.useState<DeclaredPosition>(initialPosition);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError(null);
    setMessage(null);

    const parsed = declaredPositionUpdateSchema.safeParse({
      position: selected,
    });

    if (!parsed.success) {
      setError("Choose a valid position.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/verification/position", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { position?: DeclaredPosition };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save your position.");
        return;
      }

      setSaved(parsed.data.position);
      setMessage("Position saved.");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
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
          <h2 className="text-base font-semibold">Your position</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Choose the position you hold in your class. This only records what
            you declare — to get representative access, claim your class below
            while review is temporarily disabled.
          </p>
        </div>
      </div>

      <div className="mt-4 max-w-sm space-y-1.5">
        <Label htmlFor="declared-position">Position</Label>
        <Select
          id="declared-position"
          value={selected}
          onChange={(event) =>
            setSelected(event.target.value as DeclaredPosition)
          }
          disabled={busy}
        >
          {DECLARED_POSITIONS.map((position) => (
            <option
              key={position}
              value={position}
            >
              {DECLARED_POSITION_LABELS[position]}
            </option>
          ))}
        </Select>
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={busy || selected === saved}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Save position
        </Button>
        <span className="text-muted-foreground text-xs">
          Changing this never creates, changes, or removes a class admin role.
        </span>
      </div>
    </form>
  );
}
