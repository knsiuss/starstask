import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the shared check-in link page (one meeting, mobile-first). */
export default function CheckInLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading check-in"
      className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6"
    >
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-5 h-64" />
    </div>
  );
}
