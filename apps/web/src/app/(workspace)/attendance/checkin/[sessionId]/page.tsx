import type { Metadata } from "next";
import Link from "next/link";

import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAttendanceMeetingView } from "@/lib/db/attendance-meetings";

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
 */
export default async function CheckInLinkPage({
  params,
}: CheckInLinkPageProps) {
  const { sessionId } = await params;
  const session = await getSessionUser();
  const view = session
    ? await getStudentAttendanceMeetingView(session.user.id)
    : null;
  const meeting = (view?.meetings ?? []).find(
    (item) => item.sessionId === sessionId,
  );

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-8 sm:px-6 sm:py-8">
      <h2 className="text-lg font-semibold tracking-tight">Check in</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        This link opens one attendance meeting. You still need to sign in and
        confirm your location.
      </p>

      {meeting ? (
        <div className="mt-5">
          <StudentMeetingList
            meetings={[meeting]}
            identity={view?.identity ?? { fullName: null, nim: null }}
            heading={meeting.courseName}
          />
        </div>
      ) : (
        <Alert
          variant="warning"
          className="mt-5"
        >
          <p className="text-xs leading-relaxed">
            That meeting is not open for you. It may have closed, or you may not
            be enrolled in its class.
          </p>
        </Alert>
      )}

      <Link
        href="/attendance"
        className="text-accent mt-4 inline-block text-sm font-medium hover:underline"
      >
        Go to my attendance
      </Link>
    </div>
  );
}
