"use client";

import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASON_MAX = 500;

type AccountDeactivateDialogProps = {
  // Part of the shared two-dialog shape; the deactivate flow does not act on
  // the address, so the value is accepted but never read.
  email: string | null;
  onDeactivated: () => void;
  disabled?: boolean;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    } | null;
    return body?.error?.message ?? "Permintaan gagal. Coba lagi.";
  } catch {
    return "Permintaan gagal. Coba lagi.";
  }
}

export function AccountDeactivateDialog({
  onDeactivated,
  disabled = false,
}: AccountDeactivateDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready = confirmation === "DEACTIVATE";

  const resetDialog = () => {
    setReason("");
    setConfirmation("");
    setError(null);
  };

  const submit = async () => {
    if (!ready || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/account/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
          confirmation: "DEACTIVATE",
        }),
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setOpen(false);
      resetDialog();
      onDeactivated();
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Periksa jaringan kamu.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Deactivate…
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) {
            return;
          }
          setOpen(next);
          if (!next) {
            resetDialog();
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Deactivate akun</DialogTitle>
          <DialogDescription>
            Masuk diblokir sementara, profil kamu tidak muncul di kelas, dan
            notifikasi dijeda. Data, histori kelas, nama, dan NIM kamu tetap
            tersimpan.
          </DialogDescription>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="deactivate-reason">Alasan (opsional)</Label>
              <span
                id="deactivate-reason-count"
                className="text-muted-foreground text-xs tabular-nums"
              >
                {reason.length}/{REASON_MAX}
              </span>
            </div>
            <Textarea
              id="deactivate-reason"
              name="deactivate-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REASON_MAX}
              rows={3}
              className="mt-1.5 min-h-20"
              aria-describedby="deactivate-reason-count"
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="deactivate-confirmation">
              Ketik DEACTIVATE untuk lanjut
            </Label>
            <Input
              id="deactivate-confirmation"
              name="deactivate-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-1.5"
            />
          </div>

          {error ? (
            <Alert
              variant="error"
              className="mt-4"
            >
              {error}
            </Alert>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={!ready || isPending}
              aria-busy={isPending}
            >
              {isPending ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : null}
              {isPending ? "Memproses..." : "Deactivate akun"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
