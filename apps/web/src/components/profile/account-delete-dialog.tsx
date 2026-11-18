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

type AccountDeleteDialogProps = {
  email: string | null;
  displayName: string;
  onDeleted: () => void;
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

export function AccountDeleteDialog({
  email,
  displayName,
  onDeleted,
}: AccountDeleteDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [emailConfirmation, setEmailConfirmation] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready =
    confirmation === "DELETE" &&
    email !== null &&
    emailConfirmation.trim().toLowerCase() === email.trim().toLowerCase();

  const resetDialog = () => {
    setReason("");
    setConfirmation("");
    setEmailConfirmation("");
    setError(null);
  };

  const submit = async () => {
    if (!ready || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
          confirmation: "DELETE",
          email: email?.trim().toLowerCase() ?? "",
        }),
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      void fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
      setOpen(false);
      onDeleted();
      router.push("/?account=deleted");
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
        variant="danger"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        Delete account…
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
          <DialogTitle>Hapus akun permanen</DialogTitle>
          <DialogDescription>
            Tindakan ini permanen dan tidak bisa dibatalkan. Nama kamu (
            {displayName}) dan NIM tetap tercantum di histori kelas.
          </DialogDescription>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-foreground text-xs font-semibold">
                Tetap tersimpan
              </h3>
              <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                <li>Nama lengkap dan nickname</li>
                <li>NIM</li>
                <li>Histori kelas, kehadiran, dan nilai</li>
                <li>Keanggotaan dan peran di kelas</li>
              </ul>
            </div>
            <div>
              <h3 className="text-foreground text-xs font-semibold">Dihapus</h3>
              <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                <li>Email dan foto profil</li>
                <li>Bio</li>
                <li>Langganan notifikasi</li>
                <li>Sesi aktif dan akses masuk</li>
              </ul>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="delete-reason">Alasan (opsional)</Label>
              <span
                id="delete-reason-count"
                className="text-muted-foreground text-xs tabular-nums"
              >
                {reason.length}/{REASON_MAX}
              </span>
            </div>
            <Textarea
              id="delete-reason"
              name="delete-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REASON_MAX}
              rows={2}
              className="mt-1.5 min-h-16"
              aria-describedby="delete-reason-count"
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="delete-confirmation">
              Ketik DELETE untuk lanjut
            </Label>
            <Input
              id="delete-confirmation"
              name="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-1.5"
            />
          </div>

          <div className="mt-4">
            <Label htmlFor="delete-email">
              Ketik email kamu untuk konfirmasi
            </Label>
            {email ? (
              <p className="text-muted-foreground mt-1 text-xs break-all">
                {email}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                Email tidak tersedia di sesi ini, penghapusan dimatikan.
              </p>
            )}
            <Input
              id="delete-email"
              name="delete-email"
              type="email"
              value={emailConfirmation}
              onChange={(event) => setEmailConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={!email}
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
              variant="danger"
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
              {isPending ? "Memproses..." : "Hapus permanen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
