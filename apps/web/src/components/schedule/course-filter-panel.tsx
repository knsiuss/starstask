import type { CalendarView } from "@starstask/contracts";

import { courseColorFor } from "@/lib/schedule/course-colors";
import { cn } from "@/lib/utils/cn";

export type CourseOption = {
  /** Stable identity key shared by subjects of the same catalog course. */
  key: string;
  name: string;
  detail: string | null;
  assignmentCount: number;
};

type CourseFilterPanelProps = {
  options: CourseOption[];
  /** null = all courses; an empty set = nothing selected. */
  selected: ReadonlySet<string> | null;
  mine: boolean;
  view: CalendarView;
  dateKey: string;
  type: string;
  classFilter: string | undefined;
};

/**
 * Multi-select course filter. A plain GET form keeps the calendar shareable:
 * repeated `subject` keys carry the selection, and `subjectsSet` tells the
 * page the form was submitted at all.
 */
export function CourseFilterPanel({
  options,
  selected,
  mine,
  view,
  dateKey,
  type,
  classFilter,
}: CourseFilterPanelProps) {
  const allChecked = selected === null;

  return (
    <form
      method="get"
      action="/schedule"
      className="space-y-4"
      aria-label="Course filters"
    >
      <input
        type="hidden"
        name="subjectsSet"
        value="1"
      />
      <input
        type="hidden"
        name="view"
        value={view}
      />
      <input
        type="hidden"
        name="date"
        value={dateKey}
      />
      {type !== "all" ? (
        <input
          type="hidden"
          name="type"
          value={type}
        />
      ) : null}
      {classFilter ? (
        <input
          type="hidden"
          name="class"
          value={classFilter}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">
          Courses
        </h3>
        <button
          type="submit"
          className="text-accent text-xs font-medium hover:underline"
        >
          Apply
        </button>
      </div>

      <label className="border-border hover:bg-subtle flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium">
        <input
          type="checkbox"
          name="all"
          value="1"
          defaultChecked={allChecked}
          className="text-accent focus-visible:outline-accent h-3.5 w-3.5 rounded"
        />
        All courses
      </label>

      <ul className="space-y-1">
        {options.map((option) => {
          const color = courseColorFor(option.key);
          const checked = allChecked || selected.has(option.key);

          return (
            <li
              key={option.key}
              className="hover:bg-subtle rounded-md"
            >
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5">
                <input
                  type="checkbox"
                  name="subject"
                  value={option.key}
                  defaultChecked={checked}
                  className="text-accent focus-visible:outline-accent h-3.5 w-3.5 shrink-0 rounded"
                />
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color.dot }}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-xs font-medium">
                    {option.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {option.detail ?? "Course"}
                    {" · "}
                    {option.assignmentCount}{" "}
                    {option.assignmentCount === 1
                      ? "assignment"
                      : "assignments"}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="border-border border-t pt-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 px-1">
          <span className="text-xs font-medium">
            Show only my assignments
            <span className="text-muted-foreground block text-[10px] font-normal">
              Only the ones you uploaded
            </span>
          </span>
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={mine}
            role="switch"
            aria-label="Show only my assignments"
            className="accent-[#45639e] h-4 w-4"
          />
        </label>
      </div>

      <div className="pt-1">
        <a
          href="/schedule"
          className={cn(
            "text-muted-foreground hover:text-foreground block text-center text-[11px] underline-offset-2 hover:underline",
          )}
        >
          Reset filters
        </a>
      </div>
    </form>
  );
}
