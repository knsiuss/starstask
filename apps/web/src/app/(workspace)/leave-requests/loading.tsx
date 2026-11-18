import { Skeleton } from "@/components/ui/skeleton";

export default function LeaveRequestsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading absence requests"
      className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-8 sm:py-8 lg:px-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl" />
          <div>
            <Skeleton className="h-8 w-48 sm:w-56" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full sm:w-80" />
          </div>
        </div>
        <Skeleton className="h-11 w-full sm:w-36" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-16 rounded-xl sm:h-20"
          />
        ))}
      </div>

      <Skeleton className="mt-4 hidden h-28 w-full rounded-xl lg:block" />

      <div className="mt-6 flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-surface rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-5 w-48" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3.5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
