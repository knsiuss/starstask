import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for university, so opening the page never feels frozen. */
export default function UniversityLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading university page"
      className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-6 h-64" />
    </div>
  );
}
