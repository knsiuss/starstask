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

const CONFIRM_LITERAL = "KELUAR";

type LeaveCourseDialogProps = {
  classSlug: string;
  courseId: string;
  courseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type LeaveResponse = {
  data?: { status?: string };
  error?: { message?: string };
};

/**
 * Confirmation dialog for leaving a single course via
 * `POST /api/classes/[slug]/courses/[courseId]/leave`.
 *
 * Only members whose `course_scope` is `selected` see the entry point; leaving
 * removes just this course's `class_member_courses` row, not class membership.
 */
export function LeaveCourseDialog({
  classSlug,
  courseId,
  courseName,
  open,
  onOpenChange,
}: LeaveCourseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset the typed confirmation whenever the dialog closes so the next
  // open starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirmText("");
      setError(null);
      setIsSubmitting(false);
    }

    onOpenChange(next);
  };

  const confirmMatches = confirmText.trim() === CONFIRM_LITERAL;

  const submit = async () => {
    if (isSubmitting || !confirmMatches) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/courses/${courseId}/leave`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const body = (await response
        .json()
        .catch(() => null)) as LeaveResponse | null;

      if (!response.ok) {
        setError(
          body?.error?.message ??
            "Tidak bisa keluar dari course ini sekarang. Coba lagi.",
        );
        return;
      }

      toast({
        variant: "success",
        title: `Kamu keluar dari course ${courseName}`,
      });
      handleOpenChange(false);
      router.push(`/classes/${classSlug}`);
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
        <DialogTitle>Keluar dari course {courseName}?</DialogTitle>
        <DialogDescription>
          Kamu hanya kehilangan akses ke course ini. Keanggotaan kelas tetap
          ada, dan riwayat yang sudah tersimpan tetap terbaca. Kamu tidak bisa
          mengakses course ini lagi tanpa undangan baru.
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
          <Label htmlFor={`leave-course-confirm-${courseId}`}>
            Ketik <span className="font-mono">{CONFIRM_LITERAL}</span> untuk
            konfirmasi
          </Label>
          <Input
            id={`leave-course-confirm-${courseId}`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={CONFIRM_LITERAL}
            disabled={isSubmitting}
            autoComplete="off"
            autoCapitalize="characters"
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
            {isSubmitting ? "Keluar..." : "Keluar course"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LeaveCourseButtonProps = {
  classSlug: string;
  courseId: string;
  courseName: string;
  className?: string;
};

/**
 * Self-contained trigger plus dialog for the course header. Kept in this file
 * so the server-rendered header can mount it without becoming a client
 * component itself.
 */
export function LeaveCourseButton({
  classSlug,
  courseId,
  courseName,
  className,
}: LeaveCourseButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`Keluar dari course ${courseName}`}
      >
        <LogOut
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
        Keluar course
      </Button>
      <LeaveCourseDialog
        classSlug={classSlug}
        courseId={courseId}
        courseName={courseName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
