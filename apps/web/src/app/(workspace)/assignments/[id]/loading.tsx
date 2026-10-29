import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Skeleton className="h-4 w-32" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-4 h-4 w-64" />
          <Skeleton className="mt-8 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    </div>
  );
}
