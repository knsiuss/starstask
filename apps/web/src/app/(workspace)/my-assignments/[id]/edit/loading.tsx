import { Skeleton } from "@/components/ui/skeleton";

export default function EditAssignmentLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />

      <div className="mt-8 space-y-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
        ))}

        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}
