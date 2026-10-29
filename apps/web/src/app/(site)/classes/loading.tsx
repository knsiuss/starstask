import { Skeleton } from "@/components/ui/skeleton";

export default function ClassesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-52" />
      </div>

      <Skeleton className="mt-6 h-[92px] w-full rounded-xl" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-48 w-full rounded-xl"
          />
        ))}
      </div>
    </div>
  );
}
