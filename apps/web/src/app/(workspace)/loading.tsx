import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic workspace fallback for routes without their own `loading.tsx`,
 * so client navigation swaps to a skeleton instantly instead of holding
 * the previous page (or a blank screen) until the server responds.
 */
export default function WorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <Skeleton className="mt-6 h-64" />
      <Skeleton className="mt-4 h-40" />
    </div>
  );
}
