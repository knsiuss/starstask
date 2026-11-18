"use client";

import { Loader2, QrCode, Share2 } from "lucide-react";
import * as React from "react";

import { InviteQrCard } from "@/components/classes/invite-qr-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type ShareCourseButtonProps = {
  classSlug: string;
  courseId: string;
  courseName: string;
  label?: string;
  className?: string;
};

/**
 * Course-scoped invitation dialog so retake or single-course students can join
 * only this course without gaining access to the rest of the class.
 */
export function ShareCourseButton({
  classSlug,
  courseId,
  courseName,
  label = "Share",
  className,
}: ShareCourseButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [maxUses, setMaxUses] = React.useState("30");
  const [expiresInDays, setExpiresInDays] = React.useState("7");
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);

  const generateInvite = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: courseId,
          maxUses: Number(maxUses),
          expiresInDays: Number(expiresInDays),
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        data?: { invitePath?: string };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.data?.invitePath) {
        setError(body?.error?.message ?? "Could not create course invite.");
        return;
      }

      setInviteUrl(`${window.location.origin}${body.data.invitePath}`);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={className}
        aria-label={`Share ${courseName}`}
      >
        <Share2
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
        <span>{label}</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            setError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-accent-soft text-accent inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium">
              Course-only invite
            </span>
          </div>

          <DialogTitle className="mt-2">Share {courseName}</DialogTitle>
          <DialogDescription>
            Generate an invite link or QR code for retake or guest students.
            Members who join with this invite only get access to this course.
          </DialogDescription>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor={`share-uses-${courseId}`}
                className="text-xs"
              >
                Max uses
              </Label>
              <Select
                id={`share-uses-${courseId}`}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                className="mt-1 h-11 text-sm sm:h-10"
              >
                <option value="1">1 student</option>
                <option value="10">10 students</option>
                <option value="30">30 students</option>
                <option value="50">50 students</option>
                <option value="100">100 students</option>
              </Select>
            </div>

            <div>
              <Label
                htmlFor={`share-days-${courseId}`}
                className="text-xs"
              >
                Expires in
              </Label>
              <Select
                id={`share-days-${courseId}`}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                className="mt-1 h-11 text-sm sm:h-10"
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </Select>
            </div>
          </div>

          {error ? (
            <Alert
              variant="error"
              className="mt-3"
            >
              {error}
            </Alert>
          ) : null}

          <Button
            type="button"
            disabled={isBusy}
            onClick={() => void generateInvite()}
            className="mt-4 h-11 w-full sm:h-10"
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <QrCode
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            {inviteUrl ? "Generate new link & QR" : "Generate link & QR"}
          </Button>

          {inviteUrl ? (
            <div className="border-border mt-4 border-t pt-4">
              <InviteQrCard
                url={inviteUrl}
                label={`QR code to join ${courseName}`}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
