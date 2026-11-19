import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the lecturer create-class form: back link, header, fields. */
export default function CreateLecturerClassLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading form"
      className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-11 rounded-md" />
      </div>
      <div className="mt-6 space-y-5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
