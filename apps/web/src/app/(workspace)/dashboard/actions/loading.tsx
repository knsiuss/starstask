import { Skeleton } from "@/components/ui/skeleton";

export default function ActionCenterLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading action center"
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
