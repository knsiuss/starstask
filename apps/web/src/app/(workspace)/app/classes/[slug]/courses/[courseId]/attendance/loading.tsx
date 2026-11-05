import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the course attendance page (sheet + meeting list). The recap
 * query is the slowest part, so the sheet outline shows first.
 */
export default function CourseWorkspaceAttendanceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading course attendance"
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-16" />
      <Skeleton className="mt-6 h-8 w-56" />
      <Skeleton className="mt-4 h-64" />
      <Skeleton className="mt-4 h-40" />
    </div>
  );
}
