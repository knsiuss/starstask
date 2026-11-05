import { Skeleton } from "@/components/ui/skeleton";

export default function ClassAttendanceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading attendance"
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    </div>
  );
}
