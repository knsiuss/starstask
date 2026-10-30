import Image from "next/image";

import { CheckInReviewActions } from "@/components/sessions/check-in-review-actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { SessionCheckIn, SessionCheckInStatus } from "@/lib/db/sessions";
import { SESSION_CHECKIN_STATUS_LABELS } from "@starstask/contracts";
import { formatSessionTime } from "@starstask/shared";

const STATUS_VARIANTS: Record<SessionCheckInStatus, BadgeProps["variant"]> = {
  present: "success",
  late: "warning",
  excused: "accent",
  absent: "danger",
};

type SessionCheckInListProps = {
  sessionId: string;
  timeZone: string;
  checkIns: SessionCheckIn[];
};

function describeMethod(checkIn: SessionCheckIn): string {
  if (checkIn.method !== "geo" || checkIn.distanceM === null) {
    return "Recorded by an organizer";
  }

  const accuracy =
    checkIn.accuracyM === null ? "" : ` · ±${Math.round(checkIn.accuracyM)} m`;

  return `~${Math.round(checkIn.distanceM)} m away${accuracy}`;
}

/**
 * Attendance list for organizers.
 *
 * Only rendered for class managers; the query is under RLS, so a participant
 * who reaches this component still receives just their own row.
 */
export function SessionCheckInList({
  sessionId,
  timeZone,
  checkIns,
}: SessionCheckInListProps) {
  if (checkIns.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        Nobody has checked in yet. Students can check in from 15 minutes before
        the start until the session ends.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {checkIns.map((checkIn) => (
        <li
          key={checkIn.id}
          className="border-border rounded-lg border px-3 py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {checkIn.avatarUrl ? (
                <Image
                  src={checkIn.avatarUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-accent-soft text-accent flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                >
                  {checkIn.displayName.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm">{checkIn.displayName}</p>
                <p className="text-muted-foreground text-[11px]">
                  {formatSessionTime(checkIn.checkedInAt, timeZone)} ·{" "}
                  {describeMethod(checkIn)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANTS[checkIn.status]}>
                {SESSION_CHECKIN_STATUS_LABELS[checkIn.status]}
              </Badge>
              <CheckInReviewActions
                sessionId={sessionId}
                checkInId={checkIn.id}
                displayName={checkIn.displayName}
                initialStatus={checkIn.status}
              />
            </div>
          </div>

          {checkIn.note ? (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              {checkIn.note}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
