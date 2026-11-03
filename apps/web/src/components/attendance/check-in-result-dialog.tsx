"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ATTENDANCE_STATUS_LABELS } from "@starstask/contracts";
import { formatSessionTime } from "@starstask/shared";
import type { AttendanceCheckInStatus } from "@/lib/attendance/types";

export type CheckInResultSuccess = {
  status: AttendanceCheckInStatus;
  checkedInAt: string;
  distanceM: number | null;
  subjectName: string;
  meetingNumber: number | string;
};

export type CheckInResultFailure = {
  message: string;
  distanceM: number | null;
  radiusM: number | null;
  canRetry: boolean;
};

type Props = {
  success: CheckInResultSuccess | null;
  failure: CheckInResultFailure | null;
  onClose: () => void;
  onRetry: () => void;
  isRetrying?: boolean;
};

/**
 * Persistent check-in outcome. The modal stays until the student closes it;
 * check-in outcomes are never toast-only.
 */
export function CheckInResultDialog({
  success,
  failure,
  onClose,
  onRetry,
  isRetrying = false,
}: Props) {
  const open = Boolean(success || failure);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        {success ? (
          <>
            <div className="bg-emerald-50 text-emerald-700 flex h-12 w-12 items-center justify-center rounded-xl">
              <CircleCheck
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>
            <DialogTitle className="mt-4">Check-in Successful</DialogTitle>
            <DialogDescription asChild>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {ATTENDANCE_STATUS_LABELS[success.status] ?? success.status}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Check-in time</dt>
                  <dd className="font-medium tabular-nums">
                    {formatSessionTime(success.checkedInAt, "Asia/Jakarta")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Course</dt>
                  <dd className="font-medium">{success.subjectName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Meeting</dt>
                  <dd className="font-medium">
                    {typeof success.meetingNumber === "number"
                      ? `Pertemuan ${success.meetingNumber}`
                      : success.meetingNumber}
                  </dd>
                </div>
                {success.distanceM !== null ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Distance</dt>
                    <dd className="font-medium tabular-nums">
                      {Math.round(success.distanceM)} m
                    </dd>
                  </div>
                ) : null}
              </dl>
            </DialogDescription>
            <div className="mt-6">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : failure ? (
          <>
            <div className="bg-red-50 text-red-600 flex h-12 w-12 items-center justify-center rounded-xl">
              <CircleAlert
                aria-hidden="true"
                className="h-5 w-5"
              />
            </div>
            <DialogTitle className="mt-4">Check-in Unsuccessful</DialogTitle>
            <DialogDescription>{failure.message}</DialogDescription>
            {failure.distanceM !== null || failure.radiusM !== null ? (
              <dl className="mt-3 space-y-1 text-sm">
                {failure.distanceM !== null ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Your distance</dt>
                    <dd className="font-medium tabular-nums">
                      {Math.round(failure.distanceM)} m
                    </dd>
                  </div>
                ) : null}
                {failure.radiusM !== null ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Allowed radius</dt>
                    <dd className="font-medium tabular-nums">
                      {failure.radiusM} m
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              {failure.canRetry ? (
                <Button
                  onClick={onRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? "Retrying…" : "Retry Check In"}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isRetrying}
              >
                Close
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
