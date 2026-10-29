import { Skeleton } from "@/components/ui/skeleton";

export default function ManageClassLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-9 w-96 max-w-full" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[72px] w-full rounded-lg"
          />
        ))}
      </div>

      <Skeleton className="mt-10 h-56 w-full rounded-lg" />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}
