"use client";

import { Loader2, Trash2 } from "lucide-react";
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

type DeleteClassButtonProps = {
  classSlug: string;
  name: string;
};

/**
 * Deletes a class after the caller retypes its name.
 *
 * There is no undo: deleting a class cascades its members, sessions, leave
 * requests, schedule, and verification rows, so the typed name is the guard
 * rather than a timed undo like the assignment delete.
 */
export function DeleteClassButton({ classSlug, name }: DeleteClassButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typedName, setTypedName] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isConfirmed =
    typedName.trim().toLowerCase() === name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed || isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typedName.trim() }),
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
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          setTypedName("");
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
          This cannot be undone. Members, invitations, sessions, absence
          requests, schedule, and verification records for this class are
          deleted with it. Published assignments are archived and stop being
          public.
        </DialogDescription>

        {error ? (
          <Alert
            variant="error"
            className="mt-4"
          >
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 space-y-2">
          <Label htmlFor="delete-class-confirm">
            Type <span className="font-semibold">{name}</span> to confirm
          </Label>
          <Input
            id="delete-class-confirm"
            value={typedName}
            autoComplete="off"
            onChange={(event) => setTypedName(event.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={!isConfirmed || isBusy}
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Delete class permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
