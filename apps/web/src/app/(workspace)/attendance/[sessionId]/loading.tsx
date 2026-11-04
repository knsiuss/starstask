import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for a single attendance record page. */
export default function AttendanceRecordLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading attendance record"
      className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <Skeleton className="mt-6 h-80" />
    </div>
  );
}
