import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div>
      <div className="border-border border-b pb-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[132px] w-full rounded-xl"
          />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>

      <Skeleton className="mt-6 h-56 w-full rounded-xl" />
    </div>
  );
}
