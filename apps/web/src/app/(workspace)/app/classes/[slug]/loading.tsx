import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for Class Detail: identity header, stat tiles, quick actions,
 * and the recent-posts column.
 */
export default function ClassDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading class"
      className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-16" />
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            className="h-20"
          />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
