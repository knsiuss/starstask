/**
 * Layout math for the assignment timeline.
 *
 * One week row at a time: bars are clipped to the row, lanes are assigned
 * greedily (the widest overlap wins the earliest lane), and anything past the
 * visible lane budget is reported to the caller so it can render a bounded
 * "+N more" control instead of growing the grid without limit.
 */
import type { CalendarEvent } from "@/lib/db/calendar";

export type TimelineItemKind =
  | "assignment"
  | "class_schedule"
  | "exam"
  | "academic_event"
  | "personal"
  | "absence";

export type TimelineItem = {
  id: string;
  title: string;
  kind: TimelineItemKind;
  /** YYYY-MM-DD, inclusive. */
  startKey: string;
  /** YYYY-MM-DD, inclusive. */
  endKey: string;
  href: string | null;
  /** Course colour identity for assignment bars. */
  courseKey?: string;
  courseName?: string | null;
  courseCode?: string | null;
  /** Assignment-only display metadata. */
  deadlineKey?: string;
  isCompleted?: boolean;
  isOverdue?: boolean;
  isMine?: boolean;
  /** Raw assignment id for the completion toggle, assignments only. */
  assignmentId?: string;
  /** Underlying calendar event, when the bar represents one. */
  nativeEvent?: CalendarEvent;
};

export type PositionedItem = TimelineItem & {
  /** Zero-based lane within the week row. */
  lane: number;
  /** Column offset inside the week row, 0-6. */
  colStart: number;
  /** Width in columns, 1-7. */
  span: number;
};

/** Row-local layout result. */
export type WeekRowLayout = {
  items: PositionedItem[];
  laneCount: number;
  /** Bars that did not fit the visible lane budget. */
  hidden: TimelineItem[];
};

/** Lanes the board draws before it defers to the "+N more" dialog. */
export const MAX_VISIBLE_LANES = 3;

export const WEEK_DAY_COUNT = 7;

function endKeyOf(item: TimelineItem): string {
  return item.endKey < item.startKey ? item.startKey : item.endKey;
}

function startKeyOf(item: TimelineItem): string {
  return item.endKey < item.startKey ? item.endKey : item.startKey;
}

export function overlapsWeek(
  item: TimelineItem,
  rowStartKey: string,
  rowEndKey: string,
): boolean {
  return startKeyOf(item) <= rowEndKey && endKeyOf(item) >= rowStartKey;
}

/**
 * Clips one item to a week row and places it in the first free lane.
 */
export function layoutWeekRow(
  items: readonly TimelineItem[],
  rowStartKey: string,
  maxVisibleLanes: number = MAX_VISIBLE_LANES,
): WeekRowLayout {
  const rowEndKey = shiftKey(rowStartKey, WEEK_DAY_COUNT - 1);
  const relevant = [...items]
    .filter((item) => overlapsWeek(item, rowStartKey, rowEndKey))
    .sort(compareItems);

  const lanes: Array<Array<PositionedItem> | undefined> = Array.from(
    { length: maxVisibleLanes },
    () => [],
  );
  const hidden: TimelineItem[] = [];

  for (const item of relevant) {
    const position = clipItemToRow(item, rowStartKey);
    const lane = findFreeLane(lanes, position);

    if (lane === -1) {
      hidden.push(item);
      continue;
    }

    lanes[lane]?.push({ ...item, ...position, lane });
  }

  return {
    items: lanes.flatMap((lane) => lane ?? []),
    laneCount: countOccupiedLanes(lanes),
    hidden,
  };
}

export function splitIntoWeeks<T extends { dateKey: string }>(
  days: readonly T[],
): T[][] {
  const weeks: T[][] = [];

  for (let index = 0; index < days.length; index += WEEK_DAY_COUNT) {
    weeks.push(days.slice(index, index + WEEK_DAY_COUNT));
  }

  return weeks;
}

export function shiftKey(key: string, delta: number): string {
  const date = new Date(`${key}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid calendar key");
  }

  date.setUTCDate(date.getUTCDate() + delta);

  return date.toISOString().slice(0, 10);
}

/** Days the item spans inside the row, measured in whole columns. */
function clipItemToRow(
  item: TimelineItem,
  rowStartKey: string,
): Pick<PositionedItem, "colStart" | "span"> {
  const start = startKeyOf(item) > rowStartKey ? startKeyOf(item) : rowStartKey;
  const end = endKeyOf(item);
  const colStart = Math.max(0, diffDays(rowStartKey, start));
  const lastCol = Math.min(WEEK_DAY_COUNT - 1, colStart + diffDays(start, end));

  return {
    colStart,
    span: lastCol - colStart + 1,
  };
}

function findFreeLane(
  lanes: Array<Array<PositionedItem> | undefined>,
  position: Pick<PositionedItem, "colStart" | "span">,
): number {
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index];

    if (!lane) {
      continue;
    }

    const itemEnd = position.colStart + position.span;
    const clashes = lane.some((placed) => {
      const placedEnd = placed.colStart + placed.span;

      return position.colStart < placedEnd && placed.colStart < itemEnd;
    });

    if (!clashes) {
      return index;
    }
  }

  return -1;
}

function countOccupiedLanes(
  lanes: Array<Array<PositionedItem> | undefined>,
): number {
  return lanes.filter((lane) => (lane?.length ?? 0) > 0).length;
}

function compareItems(left: TimelineItem, right: TimelineItem): number {
  const leftStart = startKeyOf(left);
  const rightStart = startKeyOf(right);

  if (leftStart !== rightStart) {
    return leftStart < rightStart ? -1 : 1;
  }

  const leftSpan = diffDays(startKeyOf(left), endKeyOf(left));
  const rightSpan = diffDays(startKeyOf(right), endKeyOf(right));

  if (leftSpan !== rightSpan) {
    return rightSpan - leftSpan;
  }

  return left.title.localeCompare(right.title);
}

export function diffDays(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return 0;
  }

  return Math.round((to - from) / (24 * 60 * 60 * 1_000));
}
