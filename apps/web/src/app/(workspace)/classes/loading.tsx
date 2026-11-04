import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for My Classes: header, filter strip, and the card grid. */
export default function ClassesLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading classes"
      className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton
            key={index}
            className="h-40"
          />
        ))}
      </div>
    </div>
  );
}
