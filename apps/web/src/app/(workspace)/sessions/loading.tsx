import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-3 h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-44" />
      </div>

      <Skeleton className="mt-6 h-[188px] w-full rounded-xl" />

      <div className="mt-8 flex items-center gap-2.5">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-surface rounded-xl border p-5"
          >
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-6 w-3/4" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <Skeleton className="mt-5 h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
