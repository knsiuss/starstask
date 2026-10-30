import { CalendarDays, MapPin, Users, Video } from "lucide-react";
import Link from "next/link";

import { AddToCalendarLink } from "@/components/sessions/add-to-calendar-link";
import { SessionStatusBadge } from "@/components/sessions/session-status-badge";
import { Badge } from "@/components/ui/badge";
import type { SessionSummary } from "@/lib/db/sessions";
import {
  formatSessionRange,
  formatSessionTime,
  timeZoneLabel,
} from "@starstask/shared";
import { RSVP_STATUS_LABELS, SESSION_TYPE_LABELS } from "@starstask/contracts";

type SessionCardProps = {
  session: SessionSummary;
  /** Class name is redundant on a class-scoped page. */
  showClass?: boolean;
};

/**
 * One session in a list.
 *
 * A cancelled session keeps its card so participants can see it was called off,
 * but loses the calendar action and reads as muted.
 */
export function SessionCard({ session, showClass = true }: SessionCardProps) {
  const isCancelled = session.status === "cancelled";
  const spotsLeft =
    session.capacity === null
      ? null
      : Math.max(session.capacity - session.goingCount, 0);

  return (
    <article
      className={`border-border bg-surface flex h-full flex-col rounded-xl border p-5 transition-colors ${
        isCancelled ? "opacity-70" : "hover:border-accent/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SessionStatusBadge status={session.status} />
          {showClass ? (
            <Link
              href={`/classes/${session.classSlug}`}
              className="bg-muted text-muted-foreground hover:text-accent rounded-full px-2.5 py-0.5 text-xs font-medium"
            >
              {session.className}
            </Link>
          ) : null}
          <Badge variant="neutral">
            {session.sessionType === "online" ? (
              <Video
                aria-hidden="true"
                className="h-3 w-3"
              />
            ) : (
              <MapPin
                aria-hidden="true"
                className="h-3 w-3"
              />
            )}
            {SESSION_TYPE_LABELS[session.sessionType]}
          </Badge>
          {session.visibility === "public" ? (
            <Badge variant="accent">Open to all</Badge>
          ) : null}
        </div>
      </div>

      <h3 className="mt-3 text-lg leading-snug font-semibold tracking-tight">
        <Link
          href={`/sessions/${session.id}`}
          className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {session.title}
        </Link>
      </h3>

      <p className="text-foreground mt-2 flex items-center gap-1.5 text-sm">
        <CalendarDays
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4 shrink-0"
        />
        {formatSessionRange(session.startsAt, session.endsAt, session.timeZone)}
      </p>

      <p className="text-muted-foreground mt-1 text-xs">
        {isCancelled && session.cancelledAt
          ? `Cancelled · originally ${formatSessionTime(session.startsAt, session.timeZone)} ${timeZoneLabel(session.timeZone)}`
          : `Organised by ${session.organizerName}`}
      </p>

      <div className="text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Users
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          {session.goingCount} going
          {session.maybeCount > 0 ? ` · ${session.maybeCount} maybe` : ""}
          {spotsLeft !== null ? ` · ${spotsLeft} spots left` : ""}
        </span>

        <span className="flex flex-wrap items-center gap-3">
          {session.viewerStatus ? (
            <span className="text-accent font-medium">
              You are {RSVP_STATUS_LABELS[session.viewerStatus].toLowerCase()}
            </span>
          ) : null}
          <AddToCalendarLink session={session} />
        </span>
      </div>
    </article>
  );
}
