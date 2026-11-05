import { Skeleton } from "@/components/ui/skeleton";

export default function CourseLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="mt-4">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div className="mt-5 flex gap-2 border-b pb-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-8 w-20 rounded-md"
          />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
