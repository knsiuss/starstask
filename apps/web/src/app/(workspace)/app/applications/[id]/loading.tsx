import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-2/3" />
      <Skeleton className="mt-3 h-5 w-24 rounded-full" />

      <div className="border-border bg-surface mt-6 space-y-3 rounded-xl border p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-10/12" />
      </div>

      <div className="mt-6 space-y-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
