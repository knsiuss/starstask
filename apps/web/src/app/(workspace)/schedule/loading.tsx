import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the weekly schedule calendar. */
export default function ScheduleLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading schedule"
      className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <Skeleton className="mt-6 h-[28rem]" />
    </div>
  );
}
