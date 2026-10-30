import { Skeleton } from "@/components/ui/skeleton";

export default function MyClassesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-9 w-52" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>

      <Skeleton className="mt-6 h-[124px] w-full rounded-xl" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-52 w-full rounded-xl"
          />
        ))}
      </div>
    </div>
  );
}
