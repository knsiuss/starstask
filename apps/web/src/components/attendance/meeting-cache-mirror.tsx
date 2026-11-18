"use client";

import * as React from "react";

import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";
import { readLastView, saveLastView } from "@/lib/offline/checkin-cache";

type Identity = { fullName: string | null; nim: string | null };

/**
 * Mirrors the server-rendered meeting payload into IndexedDB on mount so the
 * deep-link page can fall back to the cached view when the network is gone.
 * SSR output itself is never cached; this stores the same fields the page
 * already renders for this user. Active sessions and check-in slots written
 * by the /attendance page mirror are preserved.
 */
export function MeetingCacheMirror({
  meetings,
  identity,
  children,
}: {
  meetings: StudentAttendanceMeeting[];
  identity: Identity;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const existing = await readLastView();

      if (cancelled) {
        return;
      }

      await saveLastView({
        meetings,
        identity,
        activeSessions: existing?.activeSessions ?? [],
        checkInState: existing?.checkInState ?? {
          meetings: {},
          sessions: {},
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [meetings, identity]);

  return <>{children}</>;
}
