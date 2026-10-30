import { Skeleton } from "@/components/ui/skeleton";

export default function DeveloperLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-border border-b pb-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-32 rounded-xl"
          />
        ))}
      </div>

      <Skeleton className="mt-6 h-64 rounded-xl" />
      <Skeleton className="mt-6 h-72 rounded-xl" />
    </div>
  );
}
