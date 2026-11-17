import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading assignment details"
      className="mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6 sm:pt-8 sm:pb-12"
    >
      <Skeleton className="h-4 w-40" />

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-9 w-4/5 max-w-xl" />
        <div className="flex flex-wrap gap-4 pt-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
        <div className="border-border bg-surface space-y-4 rounded-xl border p-5 sm:p-6">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="border-border border-t pt-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-16 w-full rounded-lg" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
