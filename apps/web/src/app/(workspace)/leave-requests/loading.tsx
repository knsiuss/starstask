import { Skeleton } from "@/components/ui/skeleton";

export default function LeaveRequestsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="mt-3 h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>

      <Skeleton className="mt-6 h-[122px] w-full rounded-xl" />

      <div className="mt-8 flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-card rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-5 w-48" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3.5 w-3/4" />
            <Skeleton className="mt-2 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
