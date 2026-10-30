import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />

      <div className="mt-8 space-y-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <section key={index}>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />

            <div className="border-border bg-surface mt-4 space-y-3 rounded-xl border p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
