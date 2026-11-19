"use client";

import { Loader2, LogOut } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";

type LeaveClassDialogProps = {
  classSlug: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type LeaveResponse = {
  data?: { status?: string; promotedUserId?: string | null };
  error?: { message?: string };
};

/**
 * Confirmation dialog for leaving a class via `POST /api/classes/[slug]/leave`.
 *
 * The typed confirmation uses the class name exactly as displayed so a stray
 * tap cannot drop membership. History stays readable server-side; leaving
 * only removes the caller's membership.
 */
export function LeaveClassDialog({
  classSlug,
  className,
  open,
  onOpenChange,
}: LeaveClassDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Closing the dialog (Escape, outside click, Cancel, or success) always
  // clears the typed confirmation so the next open starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirmText("");
      setError(null);
      setIsSubmitting(false);
    }

    onOpenChange(next);
  };

  const confirmMatches = confirmText.trim() === className.trim();

  const submit = async () => {
    if (isSubmitting || !confirmMatches) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response
        .json()
        .catch(() => null)) as LeaveResponse | null;

      if (!response.ok) {
        setError(
          body?.error?.message ??
            "Tidak bisa keluar dari kelas ini sekarang. Coba lagi.",
        );
        return;
      }

      const promoted = body?.data?.promotedUserId;
      toast({
        variant: "success",
        title: `Kamu keluar dari ${className}`,
        description: promoted
          ? "Anggota terlama otomatis menjadi admin kelas."
          : undefined,
      });
      handleOpenChange(false);
      router.push("/classes");
      router.refresh();
    } catch {
      setError("Gangguan jaringan. Periksa koneksi kamu lalu coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent>
        <DialogTitle>Keluar dari {className}?</DialogTitle>
        <DialogDescription>
          Data dan riwayat kelas tetap ada, dan kamu masih bisa membaca riwayat
          setelah keluar. Kamu tidak bisa masuk lagi tanpa undangan baru. Kalau
          kamu satu-satunya admin, anggota terlama otomatis jadi admin kelas.
        </DialogDescription>

        {error ? (
          <Alert
            variant="error"
            className="mt-3"
          >
            {error}
          </Alert>
        ) : null}

        <div className="mt-4 space-y-1.5">
          <Label htmlFor={`leave-class-confirm-${classSlug}`}>
            Ketik <span className="font-mono">{className}</span> untuk
            konfirmasi
          </Label>
          <Input
            id={`leave-class-confirm-${classSlug}`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={className}
            disabled={isSubmitting}
            autoComplete="off"
            aria-invalid={confirmText.length > 0 && !confirmMatches}
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={() => void submit()}
            disabled={isSubmitting || !confirmMatches}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <LogOut
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            {isSubmitting ? "Keluar..." : "Keluar kelas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
