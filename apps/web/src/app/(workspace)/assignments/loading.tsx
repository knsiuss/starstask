import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentsLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-[1360px] px-4 pt-5 pb-24 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10"
    >
      <span className="sr-only">Loading assignments</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Skeleton className="h-8 w-44 sm:h-9 sm:w-52" />
          <Skeleton className="mt-2 h-4 w-64 sm:w-80" />
        </div>
        <Skeleton className="h-11 w-full rounded-md sm:h-10 sm:w-44" />
      </div>

      <div className="border-border bg-surface mt-5 rounded-xl border p-4 lg:hidden">
        <Skeleton className="h-4 w-20" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      <div className="border-border mt-5 flex gap-3 border-b pb-2.5 lg:mt-6">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-6 w-36 rounded-md" />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_165px_165px_155px]">
            <Skeleton className="h-11 w-full rounded-md sm:col-span-3 sm:h-10 lg:col-span-1" />
            <Skeleton className="h-11 w-full rounded-md sm:h-10" />
            <Skeleton className="h-11 w-full rounded-md sm:h-10" />
            <Skeleton className="h-11 w-full rounded-md sm:h-10" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="border-border bg-surface rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-5 w-36 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-32 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden space-y-4 lg:block">
          <div className="border-border bg-surface rounded-xl border p-5">
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 space-y-4">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          </div>
          <div className="border-border bg-surface rounded-xl border p-5">
            <Skeleton className="h-4 w-36" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
