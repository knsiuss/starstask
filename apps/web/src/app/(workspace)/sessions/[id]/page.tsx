import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SetupNotice } from "@/components/layout/setup-notice";
import { AddToCalendarLink } from "@/components/sessions/add-to-calendar-link";
import { CalendarSyncButton } from "@/components/sessions/calendar-sync-button";
import { CheckInCard } from "@/components/sessions/check-in-card";
import { CheckInLocationCard } from "@/components/sessions/check-in-location-card";
import { CheckInManualAdd } from "@/components/sessions/check-in-manual-add";
import { SessionCheckInList } from "@/components/sessions/check-in-list";
import { RsvpControls } from "@/components/sessions/rsvp-controls";
import { SessionManageActions } from "@/components/sessions/session-manage-actions";
import { SessionStatusBadge } from "@/components/sessions/session-status-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getClassRole, listClassMembers } from "@/lib/db/classes";
import {
  getSessionById,
  getSessionCheckIns,
  getSessionParticipants,
} from "@/lib/db/sessions";
import { resolveSessionViewerState } from "@/features/sessions/view-state";
import { isSupabaseConfigured } from "@/lib/env/public";
import { getCalendarConnectionSummary } from "@/features/integrations/google-calendar-service";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google/config";
import { buildLoginPath } from "@/lib/security/redirect";
import {
  isSafeHttpUrl,
  RSVP_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  sessionIdSchema,
} from "@starstask/contracts";
import { getCurrentCheckInWindowState } from "@/features/sessions/check-in-window";
import {
  formatSessionDate,
  formatSessionRange,
  formatSessionTime,
  sessionDurationMinutes,
  timeZoneLabel,
} from "@starstask/shared";

export const dynamic = "force-dynamic";

type SessionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<SessionPageProps, "params">): Promise<Metadata> {
  const { id } = await params;
  const parsedId = sessionIdSchema.safeParse(id);

  if (!parsedId.success || !isSupabaseConfigured()) {
    return {
      title: "Session not found",
      robots: { index: false, follow: false },
    };
  }

  const session = await getSessionById(parsedId.data);

  if (!session) {
    return {
      title: "Session not found",
      robots: { index: false, follow: false },
    };
  }

  // A session page carries participant names and a join link, so it is never
  // indexed even when the session itself is public.
  return {
    title: session.title,
    description: `${session.className} · ${formatSessionRange(session.startsAt, session.endsAt, session.timeZone)}`,
    robots: { index: false, follow: false },
  };
}

export default async function SessionPage({
  params,
  searchParams,
}: SessionPageProps) {
  const { id } = await params;
  const parsedId = sessionIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const [session, viewer, query] = await Promise.all([
    getSessionById(parsedId.data),
    getSessionUser(),
    searchParams,
  ]);

  if (!session) {
    notFound();
  }

  const [role, calendar, checkIns] = await Promise.all([
    viewer ? getClassRole(session.classId) : Promise.resolve(null),
    viewer
      ? getCalendarConnectionSummary(viewer.user.id)
      : Promise.resolve(null),
    viewer ? getSessionCheckIns(session.id) : Promise.resolve([]),
  ]);
  const participants =
    viewer && role?.canManage ? await getSessionParticipants(session.id) : [];
  // Only managers need the roster, and only to record attendance manually.
  const members =
    role?.canManage && session.sessionType === "in_person"
      ? await listClassMembers(session.classId)
      : [];
  const viewerCheckIn = viewer
    ? (checkIns.find((item) => item.userId === viewer.user.id) ?? null)
    : null;
  const checkInWindowState = getCurrentCheckInWindowState(
    session.startsAt,
    session.endsAt,
  );

  const viewerState = resolveSessionViewerState(session, {
    isSignedIn: viewer !== null,
  });
  const durationMinutes = sessionDurationMinutes(
    session.startsAt,
    session.endsAt,
  );
  const joinUrl =
    session.meetingUrl && isSafeHttpUrl(session.meetingUrl)
      ? session.meetingUrl
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/sessions"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        All sessions
      </Link>

      {query.created ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Session scheduled. Participants can now RSVP and add it to their
          calendar.
        </Alert>
      ) : null}
      {query.updated ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Your changes have been saved.
        </Alert>
      ) : null}

      {session.status === "cancelled" ? (
        <Alert
          variant="warning"
          className="mt-4"
        >
          <p className="font-medium">This session was cancelled.</p>
          <p className="mt-1">
            {session.cancelledAt
              ? `It was called off on ${formatSessionDate(session.cancelledAt, session.timeZone)}. `
              : ""}
            Anyone who RSVP&apos;d has been notified.
          </p>
        </Alert>
      ) : null}

      {session.status === "completed" ? (
        <Alert
          variant="info"
          className="mt-4"
        >
          This session has already taken place. The details stay up for
          reference.
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article>
          <div className="flex flex-wrap items-center gap-2">
            <SessionStatusBadge status={session.status} />
            <Link
              href={`/classes/${session.classSlug}`}
              className="bg-muted text-muted-foreground hover:text-accent rounded-full px-2.5 py-0.5 text-xs font-medium"
            >
              {session.className}
            </Link>
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

          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            {session.title}
          </h1>

          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
              />
              {formatSessionRange(
                session.startsAt,
                session.endsAt,
                session.timeZone,
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-4 w-4"
              />
              {durationMinutes} min
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users
                aria-hidden="true"
                className="h-4 w-4"
              />
              Organised by {session.organizerName}
            </span>
          </div>

          <div className="mt-5">
            {viewer ? (
              <RsvpControls
                sessionId={session.id}
                initialStatus={session.viewerStatus}
                initialCounts={{
                  goingCount: session.goingCount,
                  maybeCount: session.maybeCount,
                  capacity: session.capacity,
                }}
                canRespond={viewerState.canRespond}
                closedReason={viewerState.closedReason}
              />
            ) : (
              <Alert variant="info">
                <p className="font-medium">Sign in to RSVP</p>
                <p className="mt-1">
                  <Link
                    href={buildLoginPath(`/sessions/${session.id}`)}
                    className="text-accent font-medium hover:underline"
                  >
                    Sign in with Google
                  </Link>{" "}
                  to save your place and get a reminder before it starts.
                </p>
              </Alert>
            )}
          </div>

          {viewer &&
          session.sessionType === "in_person" &&
          session.hasCheckInLocation &&
          (session.status === "scheduled" || viewerCheckIn) ? (
            <CheckInCard
              sessionId={session.id}
              timeZone={session.timeZone}
              startsAt={session.startsAt}
              endsAt={session.endsAt}
              radiusM={session.checkinRadiusM}
              initialWindowState={
                session.status === "scheduled" ? checkInWindowState : "closed"
              }
              initialCheckIn={
                viewerCheckIn
                  ? {
                      status: viewerCheckIn.status,
                      checkedInAt: viewerCheckIn.checkedInAt,
                      distanceM: viewerCheckIn.distanceM,
                      accuracyM: viewerCheckIn.accuracyM,
                    }
                  : null
              }
            />
          ) : null}

          {joinUrl ? (
            <section
              aria-labelledby="join-heading"
              className="mt-6"
            >
              <h2
                id="join-heading"
                className="text-lg font-semibold"
              >
                Join the session
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                The link is only shown to signed-in members of this class.
              </p>
              <Button
                asChild
                className="mt-3"
              >
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Open meeting link
                </a>
              </Button>
            </section>
          ) : null}

          {session.sessionType === "in_person" && session.location ? (
            <section
              aria-labelledby="location-heading"
              className="mt-6"
            >
              <h2
                id="location-heading"
                className="text-lg font-semibold"
              >
                Where
              </h2>
              <p className="text-foreground mt-2 inline-flex items-start gap-1.5 text-sm">
                <MapPin
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                />
                {session.location}
              </p>
            </section>
          ) : null}

          {session.agenda ? (
            <section
              aria-labelledby="agenda-heading"
              className="mt-8"
            >
              <h2
                id="agenda-heading"
                className="text-lg font-semibold"
              >
                Agenda
              </h2>
              <div className="text-foreground mt-3 text-sm leading-relaxed whitespace-pre-line">
                {session.agenda}
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="about-heading"
            className="mt-8"
          >
            <h2
              id="about-heading"
              className="text-lg font-semibold"
            >
              About this session
            </h2>
            <div className="text-foreground mt-3 text-sm leading-relaxed whitespace-pre-line">
              {session.description}
            </div>
          </section>

          {role?.canManage ? (
            <section
              aria-labelledby="participants-heading"
              className="mt-8"
            >
              <h2
                id="participants-heading"
                className="text-lg font-semibold"
              >
                Participants
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Only class managers can see who responded. Everyone else sees
                the counts.
              </p>
              {participants.length === 0 ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  Nobody has responded yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {participants.map((participant) => (
                    <li
                      key={participant.userId}
                      className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {participant.avatarUrl ? (
                          <Image
                            src={participant.avatarUrl}
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
                            {participant.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate text-sm">
                          {participant.displayName}
                        </span>
                      </span>
                      <Badge
                        variant={
                          participant.status === "going"
                            ? "success"
                            : participant.status === "maybe"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {RSVP_STATUS_LABELS[participant.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {role?.canManage && session.sessionType === "in_person" ? (
            <section
              aria-labelledby="attendance-heading"
              className="mt-8"
            >
              <h2
                id="attendance-heading"
                className="text-lg font-semibold"
              >
                Attendance
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Location check-ins are self-reported. Use the status control to
                correct a row; every change is recorded in the audit log.
              </p>
              <SessionCheckInList
                sessionId={session.id}
                timeZone={session.timeZone}
                checkIns={checkIns}
              />
              <CheckInManualAdd
                sessionId={session.id}
                members={members.map((member) => ({
                  userId: member.user_id,
                  displayName: member.display_name,
                }))}
              />
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow
                label="Class"
                value={session.className}
              />
              <DetailRow
                label="Starts"
                value={`${formatSessionDate(session.startsAt, session.timeZone, { withWeekday: true })}, ${formatSessionTime(session.startsAt, session.timeZone)}`}
              />
              <DetailRow
                label="Ends"
                value={`${formatSessionDate(session.endsAt, session.timeZone, { withWeekday: true })}, ${formatSessionTime(session.endsAt, session.timeZone)}`}
              />
              <DetailRow
                label="Time zone"
                value={`${session.timeZone} (${timeZoneLabel(session.timeZone)})`}
              />
              <DetailRow
                label="Format"
                value={SESSION_TYPE_LABELS[session.sessionType]}
              />
              <DetailRow
                label="Capacity"
                value={
                  session.capacity === null
                    ? "No limit"
                    : `${session.goingCount} of ${session.capacity} places taken`
                }
              />
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Registration closes
                </dt>
                <dd className="mt-0.5">
                  {session.registrationDeadline ? (
                    `${formatSessionDate(session.registrationDeadline, session.timeZone)}, ${formatSessionTime(session.registrationDeadline, session.timeZone)}`
                  ) : (
                    <span className="text-muted-foreground">
                      When the session starts
                    </span>
                  )}
                </dd>
              </div>
              {session.assignmentId ? (
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Related assignment
                  </dt>
                  <dd className="mt-0.5">
                    <Link
                      href={`/assignments/${session.assignmentId}`}
                      className="text-accent hover:underline"
                    >
                      View the assignment
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Add to your calendar</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              The link below opens Google Calendar with the details filled in.
              No account connection is needed.
            </p>
            <div className="mt-3 flex flex-col items-start gap-3">
              <AddToCalendarLink
                session={session}
                className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              />
              {viewer &&
              calendar?.connected &&
              session.status === "scheduled" ? (
                <CalendarSyncButton sessionId={session.id} />
              ) : null}
              {viewer &&
              isGoogleCalendarConfigured() &&
              !calendar?.connected ? (
                <Link
                  href="/settings/calendar"
                  className="text-muted-foreground hover:text-accent text-xs underline-offset-4 hover:underline"
                >
                  Connect Google Calendar to sync automatically
                </Link>
              ) : null}
            </div>
          </Card>

          {role?.canManage &&
          session.sessionType === "in_person" &&
          session.status === "scheduled" ? (
            <CheckInLocationCard
              sessionId={session.id}
              hasCheckInLocation={session.hasCheckInLocation}
              radiusM={session.checkinRadiusM}
            />
          ) : null}

          <SessionManageActions
            sessionId={session.id}
            classSlug={session.classSlug}
            status={session.status}
            canManage={role?.canManage ?? false}
          />
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
