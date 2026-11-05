/**
 * Skeleton shown while the assignments workspace loads, mirroring the header,
 * tab strip, filter bar, list, and sidebar layout.
 */
export default function AssignmentsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8"
      aria-hidden="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="skeleton h-8 w-44 rounded-lg" />
          <div className="skeleton mt-2 h-4 w-72 rounded" />
        </div>
        <div className="skeleton h-10 w-44 rounded-md" />
      </div>
      <div className="skeleton mt-6 h-10 w-80 rounded-r-lg" />
      <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="skeleton h-10 w-full rounded-lg" />
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="skeleton h-24 w-full rounded-xl"
            />
          ))}
        </div>
        <div className="space-y-5">
          <div className="skeleton h-40 w-full rounded-xl" />
          <div className="skeleton h-56 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
