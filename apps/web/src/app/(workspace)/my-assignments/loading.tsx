import { Skeleton } from "@/components/ui/skeleton";

export default function MyAssignmentsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-48" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-border rounded-lg border p-4"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
