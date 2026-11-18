import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for one course's attendance and grades detail. */
export default function CourseAttendanceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading course attendance"
      className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:px-8 sm:py-8 lg:px-10"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-64 max-w-full" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="mt-8 h-6 w-36" />
      <Skeleton className="mt-3 h-64 rounded-xl" />
    </div>
  );
}
