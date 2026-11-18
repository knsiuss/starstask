import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MeetingCacheMirror } from "@/components/attendance/meeting-cache-mirror";
import { MeetingCachedView } from "@/components/attendance/meeting-cached-view";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAttendanceMeetingView } from "@/lib/db/attendance-meetings";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Check in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CheckInLinkPageProps = {
  params: Promise<{ sessionId: string }>;
};

/**
 * Per-meeting check-in deep link shared by the class admin.
 *
 * This page is inside the workspace, so the visitor must already be signed
 * in. It only narrows the existing student view to one meeting — GPS,
 * identity, radius, and window checks all still run on the server.
 *
 * SSR output is never cached (L4). When the server fetch throws, the page
 * renders `MeetingCachedView`, which reads IndexedDB on the client instead.
 */
export default async function CheckInLinkPage({
  params,
}: CheckInLinkPageProps) {
  const { sessionId } = await params;
  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/attendance/checkin/${sessionId}`));
  }

  let view: Awaited<ReturnType<typeof getStudentAttendanceMeetingView>> | null =
    null;

  try {
    view = await getStudentAttendanceMeetingView(session.user.id);
  } catch (error) {
    // Network/data failure: fall back to the on-device cached view instead
    // of surfacing a bare error. The fallback is client-only by design.
    console.error("[attendance] meeting view fetch failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
  }

  if (!view) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-8 sm:px-6 sm:py-8">
        <h2 className="text-lg font-semibold tracking-tight">Check in</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This link opens one attendance meeting. You still need to sign in and
          confirm your location.
        </p>
        <MeetingCachedView sessionId={sessionId} />
        <Link
          href="/attendance"
          className="text-accent mt-4 inline-block text-sm font-medium hover:underline"
        >
          Go to my attendance
        </Link>
      </div>
    );
  }

  const meeting = view.meetings.find((item) => item.sessionId === sessionId);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-8 sm:px-6 sm:py-8">
      <h2 className="text-lg font-semibold tracking-tight">Check in</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        This link opens one attendance meeting. You still need to sign in and
        confirm your location.
      </p>

      <MeetingCacheMirror
        meetings={view.meetings}
        identity={view.identity}
      >
        {meeting ? (
          <div className="mt-5">
            <StudentMeetingList
              meetings={[meeting]}
              identity={view.identity}
              heading={meeting.courseName}
            />
          </div>
        ) : (
          <Alert
            variant="warning"
            className="mt-5"
          >
            <p className="text-xs leading-relaxed">
              That meeting is not open for you. It may have closed, or you may
              not be enrolled in its class.
            </p>
          </Alert>
        )}
      </MeetingCacheMirror>

      <Link
        href="/attendance"
        className="text-accent mt-4 inline-block text-sm font-medium hover:underline"
      >
        Go to my attendance
      </Link>
    </div>
  );
}
