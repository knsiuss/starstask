import { Skeleton } from "@/components/ui/skeleton";

export default function ManageClassLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-28" />

      <div className="mt-4 flex items-start gap-4">
        <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto border-b pb-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-8 w-24 shrink-0 rounded-md"
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-1.5 sm:gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[72px] w-full rounded-2xl sm:h-[76px]"
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}
