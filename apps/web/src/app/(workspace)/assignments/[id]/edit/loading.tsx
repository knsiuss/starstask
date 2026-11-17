import { Skeleton } from "@/components/ui/skeleton";

export default function EditAssignmentLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-6 sm:py-10">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-8 w-56 sm:h-9 sm:w-64" />
      <Skeleton className="mt-2 h-4 w-full max-w-md" />

      <div className="mt-6 space-y-6 sm:mt-8">
        <div className="border-border bg-surface space-y-5 rounded-xl border p-4 sm:p-6">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-36 w-full" />
          </div>
        </div>

        <div className="border-border bg-surface space-y-5 rounded-xl border p-4 sm:p-6">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>

        <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:p-5">
          <Skeleton className="h-11 w-full sm:w-36" />
          <Skeleton className="h-11 w-full sm:w-24" />
        </div>
      </div>
    </div>
  );
}
