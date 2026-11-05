import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for notifications, so opening the bell page never feels frozen. */
export default function NotificationsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading notifications"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-6 h-20" />
      <Skeleton className="mt-3 h-20" />
      <Skeleton className="mt-3 h-20" />
    </div>
  );
}
