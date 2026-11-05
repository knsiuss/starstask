import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for submit, so opening the form never feels frozen. */
export default function SubmitLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading submit form"
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-12" />
      <Skeleton className="mt-3 h-32" />
      <Skeleton className="mt-3 h-12 w-40" />
    </div>
  );
}
