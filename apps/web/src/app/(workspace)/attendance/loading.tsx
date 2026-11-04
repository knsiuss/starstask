import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the student attendance overview (course table + active
 * check-in), so tapping Attendance on mobile never feels frozen.
 */
export default function AttendanceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading attendance"
      className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
