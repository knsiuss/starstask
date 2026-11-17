import { PageShell } from "@/components/layout/page-shell";

const KPI_INDICES = [0, 1, 2, 3] as const;
const SCHEDULE_ROWS = [0, 1] as const;
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const CLASS_CARDS = [0, 1, 2, 3] as const;
const RAIL_ACTIONS = [0, 1, 2] as const;

/**
 * Skeleton shown while the `/app` dashboard loads.
 * Mirrors the 12-column dashboard shell: header, 4-card KPI strip,
 * 8-column primary workflow (schedule, week, classes), and 4-column context rail.
 */
export default function DashboardLoading() {
  return (
    <PageShell width="canvas">
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <span className="sr-only">Loading dashboard</span>

        <div
          aria-hidden="true"
          className="space-y-6"
        >
          {/* Header + 4-card KPI strip */}
          <section className="space-y-4">
            <div className="border-border bg-surface flex flex-col justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center">
              <div className="space-y-2">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-7 w-56 rounded-md" />
                <div className="skeleton h-4 w-72 max-w-full rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="skeleton h-9 w-28 rounded-md" />
                <div className="skeleton h-9 w-24 rounded-md" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {KPI_INDICES.map((index) => (
                <div
                  key={index}
                  className="border-border bg-surface rounded-xl border p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="skeleton h-3.5 w-24 rounded" />
                    <div className="skeleton h-6 w-6 rounded-md" />
                  </div>
                  <div className="skeleton mt-3 h-7 w-14 rounded-md" />
                  <div className="skeleton mt-2 h-3 w-32 rounded" />
                </div>
              ))}
            </div>
          </section>

          {/* 12-column body: 8-col primary workflow + 4-col contextual rail */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
            <div className="min-w-0 space-y-6 xl:col-span-8">
              {/* Next schedule */}
              <div className="border-border bg-surface rounded-xl border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton h-5 w-20 rounded-md" />
                </div>
                <div className="mt-4 space-y-3">
                  {SCHEDULE_ROWS.map((row) => (
                    <div
                      key={row}
                      className="border-border flex items-center justify-between gap-4 rounded-lg border p-3"
                    >
                      <div className="space-y-1.5">
                        <div className="skeleton h-4 w-44 rounded" />
                        <div className="skeleton h-3 w-28 rounded" />
                      </div>
                      <div className="skeleton h-7 w-20 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly timeline */}
              <div className="border-border bg-surface rounded-xl border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="skeleton h-4 w-28 rounded" />
                  <div className="skeleton h-7 w-32 rounded-md" />
                </div>
                <div className="mt-4 grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((day) => (
                    <div
                      key={day}
                      className="skeleton h-16 rounded-lg"
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-2.5">
                  <div className="skeleton h-12 rounded-lg" />
                  <div className="skeleton h-12 rounded-lg" />
                </div>
              </div>

              {/* Classes overview */}
              <div className="border-border bg-surface rounded-xl border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="skeleton h-4 w-28 rounded" />
                  <div className="skeleton h-4 w-16 rounded" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {CLASS_CARDS.map((card) => (
                    <div
                      key={card}
                      className="border-border rounded-lg border p-3.5"
                    >
                      <div className="skeleton h-4 w-36 rounded" />
                      <div className="skeleton mt-2 h-3 w-24 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-5 xl:col-span-4">
              {/* Quick actions */}
              <div className="border-border bg-surface rounded-xl border p-5">
                <div className="skeleton h-4 w-28 rounded" />
                <div className="mt-3 space-y-2">
                  {RAIL_ACTIONS.map((action) => (
                    <div
                      key={action}
                      className="skeleton h-10 rounded-lg"
                    />
                  ))}
                </div>
              </div>

              {/* Context card */}
              <div className="border-border bg-surface rounded-xl border p-5">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-3.5 w-full rounded" />
                  <div className="skeleton h-3.5 w-4/5 rounded" />
                  <div className="skeleton h-3.5 w-3/5 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
