"use client";

import Link from "next/link";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { ActiveAttendanceSessionCard } from "@/components/attendance/active-attendance-session-card";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import { readLastView } from "@/lib/offline/checkin-cache";
import type { OfflineCheckInView } from "@/lib/offline/types";

function subscribeToConnectivity(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOfflineSnapshot(): boolean {
  return !navigator.onLine;
}

// SSR and hydration always render the online tree; the client swaps in the
// cached view after hydration if the device is actually offline.
function getServerOfflineSnapshot(): boolean {
  return false;
}

/**
 * Client boundary for the /attendance student section.
 *
 * Limitations, stated plainly: the service worker never caches SSR HTML or
 * RSC payloads (L4), so a hard navigation to /attendance while fully
 * offline cannot reach this page — the SW serves the static `/offline`
 * route instead. This boundary only shows cached content when the HTML did
 * reach the client and `navigator.onLine` is false at/after hydration —
 * i.e. the browser knew it was offline when React loaded or the connection
 * dropped before/during hydration. It does NOT hook Next error boundaries
 * and does not pretend the SW intercepts RSC payloads.
 *
 * Online path renders children untouched; offline detection is client-only
 * by design. The cached branch renders only meetings/identity/active
 * sessions — history and metrics are deliberately excluded.
 */
export function AttendanceOfflineView({
  children,
}: {
  children: React.ReactNode;
}) {
  const offline = React.useSyncExternalStore(
    subscribeToConnectivity,
    getOfflineSnapshot,
    getServerOfflineSnapshot,
  );
  const [view, setView] = React.useState<OfflineCheckInView | null | undefined>(
    undefined,
  );

  React.useEffect(() => {
    if (!offline) {
      return;
    }

    let cancelled = false;

    void readLastView().then((result) => {
      if (!cancelled) {
        setView(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [offline]);

  if (!offline) {
    return <>{children}</>;
  }

  if (view === undefined) {
    return (
      <p className="text-muted-foreground mt-4 text-sm">
        Memuat tampilan tersimpan…
      </p>
    );
  }

  const hasMeetings = Boolean(view && view.meetings.length > 0);
  const hasSessions = Boolean(view && view.activeSessions.length > 0);

  if (!view || (!hasMeetings && !hasSessions)) {
    return (
      <div className="mt-4 space-y-4">
        <Alert variant="warning">
          <p className="text-xs leading-relaxed">
            You&apos;re offline — previously opened attendance will appear here.
            Open this page once while online so it can be used offline.
          </p>
        </Alert>
        <Link
          href="/offline"
          className="text-accent inline-block text-sm font-medium hover:underline"
        >
          Ke halaman offline
        </Link>
      </div>
    );
  }

  const hasOpenMeeting = view.meetings.some(
    (meeting) => meeting.phase === "open",
  );

  return (
    <div className="space-y-8">
      <Alert
        variant="info"
        className="mt-4"
      >
        <p className="text-xs leading-relaxed">
          Tampilan tersimpan dari kunjungan terakhir. Data mungkin tidak segar.
        </p>
      </Alert>

      {hasMeetings ? (
        <StudentMeetingList
          meetings={view.meetings}
          identity={view.identity}
          heading={hasOpenMeeting ? "Active Attendance" : "Upcoming Attendance"}
        />
      ) : null}

      {hasSessions ? (
        <section aria-labelledby="offline-active-sessions">
          <h2
            id="offline-active-sessions"
            className="text-base font-semibold tracking-tight sm:text-lg"
          >
            Active attendance sessions
          </h2>
          <ul className="mt-3 space-y-3">
            {view.activeSessions.map((session) => (
              <li key={session.sessionId}>
                <ActiveAttendanceSessionCard session={session} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
