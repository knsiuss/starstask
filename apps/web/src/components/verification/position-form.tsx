"use client";

import { Loader2, Pencil } from "lucide-react";
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
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";

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
  const [isEditing, setIsEditing] = React.useState(false);
  const [selected, setSelected] =
    React.useState<DeclaredPosition>(initialPosition);
  const [saved, setSaved] = React.useState<DeclaredPosition>(initialPosition);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);

  useUnsavedChanges(isEditing && selected !== saved);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError(null);

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

      const next = body?.data?.position ?? parsed.data.position;
      setSaved(next);
      setSelected(next);
      setIsEditing(false);
      setJustSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="border-border grid gap-1 border-t px-5 py-3.5 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-baseline sm:gap-5">
        <p className="text-muted-foreground text-sm">Declared position</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm">{DECLARED_POSITION_LABELS[saved]}</p>
            {justSaved ? (
              <p className="text-success mt-1 text-xs">Position saved.</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setJustSaved(false);
              setIsEditing(true);
            }}
          >
            <Pencil
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      noValidate
      className="border-border space-y-3 border-t px-5 py-4"
    >
      <div className="max-w-sm space-y-1.5">
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

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={busy || selected === saved}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : null}
          {busy ? "Saving..." : "Save position"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setSelected(saved);
            setError(null);
            setIsEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
