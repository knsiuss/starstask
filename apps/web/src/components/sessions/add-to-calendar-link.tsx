import { CalendarPlus } from "lucide-react";

import { buildGoogleCalendarUrl } from "@starstask/shared";
import type { SessionSummary } from "@/lib/db/sessions";

type AddToCalendarLinkProps = {
  session: SessionSummary;
  className?: string;
};

/**
 * Stage A of the Calendar integration: a plain link, no OAuth grant.
 *
 * Nothing is sent to Google until the user clicks, and the event is created by
 * Google itself, so StarsTask never needs access to their calendar. A cancelled
 * session renders nothing, because `buildGoogleCalendarUrl` returns `null`.
 */
export function AddToCalendarLink({
  session,
  className,
}: AddToCalendarLinkProps) {
  const href = buildGoogleCalendarUrl({
    title: session.title,
    description: session.description,
    agenda: session.agenda,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    timeZone: session.timeZone,
    location: session.location,
    meetingUrl: session.meetingUrl,
    status: session.status,
  });

  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "text-muted-foreground hover:text-accent focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-sm text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      }
    >
      <CalendarPlus
        aria-hidden="true"
        className="h-3.5 w-3.5"
      />
      Add to Google Calendar
    </a>
  );
}
