/**
 * Skeleton shown while the dashboard loads, so navigation never feels frozen.
 * Mirrors the real layout: header, stat cards, next schedule, week strip.
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8"
      aria-hidden="true"
    >
      <div className="skeleton h-36 rounded-2xl" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="skeleton h-24 rounded-xl"
          />
        ))}
      </div>
      <div className="skeleton mt-5 h-32 rounded-xl" />
      <div className="skeleton mt-5 h-72 rounded-xl" />
    </div>
  );
}
