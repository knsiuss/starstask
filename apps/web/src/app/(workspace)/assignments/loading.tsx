import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-44" />
      </div>

      <Skeleton className="mt-6 h-[170px] w-full rounded-xl" />

      <div className="mt-8 flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="border-border flex items-center gap-4 border-b px-5 py-3.5 last:border-b-0"
          >
            <Skeleton className="hidden h-10 w-10 shrink-0 rounded-lg sm:block" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3.5 w-1/2" />
            </div>
            <Skeleton className="hidden h-8 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
