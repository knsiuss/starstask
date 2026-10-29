import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-56" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[86px] w-full rounded-lg"
          />
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        <Skeleton className="h-64 rounded-lg" />
      </div>

      <Skeleton className="mt-10 h-52 w-full rounded-lg" />
    </div>
  );
}
