import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-80" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[86px] w-full rounded-lg"
          />
        ))}
      </div>

      <Skeleton className="mt-10 h-64 w-full rounded-lg" />
      <Skeleton className="mt-10 h-64 w-full rounded-lg" />
    </div>
  );
}
