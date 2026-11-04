import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for one course's attendance detail for students. */
export default function CourseAttendanceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading course attendance"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <Skeleton className="mt-6 h-28" />
      <Skeleton className="mt-4 h-64" />
    </div>
  );
}
