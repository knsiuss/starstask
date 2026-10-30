import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[118px] w-full rounded-xl"
          />
        ))}
      </div>

      <div className="mt-8">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-2 h-3.5 w-56" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-[104px] w-full rounded-xl"
            />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-3.5 w-64" />
        <Skeleton className="mt-4 h-[292px] w-full rounded-xl" />
      </div>
    </div>
  );
}
