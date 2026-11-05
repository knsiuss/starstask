import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for university info, so opening the page never feels frozen. */
export default function UniversityInfoLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading university info"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-6 h-10 w-72 max-w-full" />
      <Skeleton className="mt-4 h-64" />
    </div>
  );
}
