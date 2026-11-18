import { Skeleton } from "@/components/ui/skeleton";

export default function ClassLeaveRequestsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <Skeleton className="h-4 w-28" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <Skeleton className="mt-6 h-[122px] w-full rounded-xl" />

      <div className="mt-8 flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-card rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-5 w-40" />
                <Skeleton className="mt-1.5 h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
