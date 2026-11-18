"use client";

import { Loader2, QrCode } from "lucide-react";
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

type CourseInviteCardProps = {
  classSlug: string;
  courseId: string;
  courseName: string;
};

/**
 * Generates a course-scoped invitation link and QR code so students invited
 * here join only this course (`course_scope = 'selected'`).
 */
export function CourseInviteCard({
  classSlug,
  courseId,
  courseName,
}: CourseInviteCardProps) {
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
    <section
      aria-labelledby="course-invite-heading"
      className="border-border bg-surface mb-6 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="course-invite-heading"
            className="text-sm font-semibold tracking-tight"
          >
            Invite to {courseName}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Students joining with this QR or link only get access to this
            course.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label
              htmlFor="course-invite-uses"
              className="text-xs"
            >
              Max uses
            </Label>
            <Select
              id="course-invite-uses"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className="mt-1 h-9 w-24 text-xs"
            >
              <option value="1">1</option>
              <option value="10">10</option>
              <option value="30">30</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>

          <div>
            <Label
              htmlFor="course-invite-days"
              className="text-xs"
            >
              Expires
            </Label>
            <Select
              id="course-invite-days"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              className="mt-1 h-9 w-28 text-xs"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </Select>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={() => void generateInvite()}
            className="h-9"
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : (
              <QrCode
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            )}
            Create course QR
          </Button>
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

      <Dialog
        open={inviteUrl !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInviteUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-xl">
          <DialogTitle>Join {courseName}</DialogTitle>
          <DialogDescription>
            Scan this QR code or share the link. Members invited here only join
            this course.
          </DialogDescription>
          {inviteUrl ? (
            <div className="mt-4">
              <InviteQrCard
                url={inviteUrl}
                label={`QR code to join ${courseName}`}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
