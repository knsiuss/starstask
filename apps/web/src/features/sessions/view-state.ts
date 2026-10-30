import { isSessionOpenForRsvp } from "@starstask/contracts";
import { formatSessionDate, formatSessionTime } from "@starstask/shared";

import type { SessionSummary } from "@/lib/db/sessions";

export type SessionViewerState = {
  /** Whether the RSVP buttons should be enabled for this viewer. */
  canRespond: boolean;
  /** Why they are disabled, or `null` when they are not. */
  closedReason: string | null;
};

type SessionWindow = Pick<
  SessionSummary,
  "status" | "startsAt" | "registrationDeadline" | "timeZone"
>;

/**
 * Resolves the RSVP affordance for one viewer.
 *
 * The clock is read here rather than in the page so the component stays a pure
 * function of its inputs. This is presentation only: `rsvp_discussion_session`
 * re-checks the status, the registration window, and the capacity inside the
 * database, so a stale page cannot produce an invalid RSVP.
 */
export function resolveSessionViewerState(
  session: SessionWindow,
  options: { isSignedIn: boolean; now?: Date },
): SessionViewerState {
  if (!options.isSignedIn) {
    return { canRespond: false, closedReason: null };
  }

  const nowMs = (options.now ?? new Date()).getTime();
  const canRespond = isSessionOpenForRsvp(session, nowMs);

  if (canRespond) {
    return { canRespond, closedReason: null };
  }

  return { canRespond, closedReason: closedReason(session, nowMs) };
}

function closedReason(session: SessionWindow, nowMs: number): string {
  if (session.status === "cancelled") {
    return "This session was cancelled, so registration is closed.";
  }

  if (session.status === "completed") {
    return "This session has already taken place.";
  }

  if (
    session.registrationDeadline &&
    Date.parse(session.registrationDeadline) <= nowMs
  ) {
    return `Registration closed on ${formatSessionDate(session.registrationDeadline, session.timeZone)}, ${formatSessionTime(session.registrationDeadline, session.timeZone)}.`;
  }

  if (Date.parse(session.startsAt) <= nowMs) {
    return "This session has already started.";
  }

  // Only reachable when the timestamps are unparseable, which the database
  // constraints already prevent.
  return "Registration for this session is closed.";
}
