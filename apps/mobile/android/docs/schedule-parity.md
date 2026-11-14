# Schedule module — Web → Native checklist

Native Screen: `app/src/main/java/id/starstask/mobile/ui/screens/ScheduleScreenNew.kt`
(+ `ScheduleAgenda.kt`, `ScheduleCalendarViews.kt`). Ported from
web `apps/web/src/app/(workspace)/schedule/page.tsx` via
`data/Calendar.kt` + `CalendarDates.kt`.

## Data parity (complete)

`data/Calendar.kt` (`listCalendar`) mirrors web `lib/db/calendar.ts`
(`listCalendarEvents`) — assignments, sessions, official events, personal
events, absences and the expanded weekly timetable, with the same
Asia/Jakarta window, lifecycle (Past Events) filter, completions,
storageReady degraded mode, and deadline ordering. `CalendarDates.kt`
mirrors `packages/shared/src/calendar.ts` including 42-cell month grids,
Monday-first weeks, 30-day list windows, and Jakarta wall-clock formatting.
Event detail (`CalendarEventSheet.kt`), create/edit forms (`EventFormSheet.kt`)
and course filters (`CalendarFilterSheet.kt` incl. `courseOptionsOf`) are
full ports.

## Rebuilt on top of the old ScheduleScreen

The previous Schedule screen only listed discussion sessions with
Timeline/Upcoming/Today tabs.

### Calendar (now implemented in ScheduleScreenNew.kt)

- Week: 7-column board, Monday-first, today highlighted, marked days,
  selected day drives the agenda below.
- Month: 42-cell grid, in/out-of-month cells, today highlighted, marked
  days, tapping a cell updates the agenda below.
- List: chronological agenda grouped by date (assignment on deadline day,
  events on start day), 30-day window, web grouping + ordering.
- Previous/next period, Today shortcut, Past Events toggle (lifecycle filter).
- Segmented Week/Month/List control replaces Timeline/Upcoming/Today tabs.

### Events

- Personal event create/edit/delete via existing EventFormSheet
  (wired into CalendarEvents.kt create/update/delete/status).
- Official event create/edit via existing EventFormSheet, admin classes only
  (scope.classes admin flag), event types class_schedule/exam/academic_event.
- Event detail sheet reused unchanged (date, time WIB, location, class,
  subject, description, status, edit, open assignment/session/absence/class).

### Assignments

- Publication→deadline ranges shown in the agenda and in the week/month spans
  (marked days = whole span, as web buildMarkedDayKeys).
- Upcoming Assignments: deadline-sorted, top 8, completion toggle, View all
  navigates to Assignments; no duplication rule: section is the source the
  web renders under every view, kept as a compact secondary block.
- Completion toggle inline on assignment rows (CompletionToggle).
- Assignment detail: opens existing AssignmentDetailScreen by assignment id.

### Global

- WIB (Asia/Jakarta) via JAKARTA_ZONE everywhere; no hardcoded +7 offsets in
  UI code (JAKARTA_OFFSET is only the ISO suffix the backend expects).
- FloatingNavDock reused (Schedule active); Scaffold content padding keeps
  content above the dock.
- Dark mode: MaterialTheme colors + theme tokens; no hardcoded palette outside
  the intentional light/assignment accents from the design brief.
- Loading/empty/error/retry states including storageReady warning.

## Known gaps (kept honest, not fake-implemented)

- Web sidebar mini-calendar and legend are represented by the month grid +
  marked-day dots; there is no separate desktop rail on mobile.
- Web type/class/mine/course filters live in CalendarCourseFilterSheet and
  are opened from the new screen's filter button (same wiring as web Apply).
- Schedule import, weekly board drag interactions and the "+N more" overflow
  dialog from the web board have no native equivalent; overflow items remain
  visible in the agenda list instead of being dropped.
- Assignment spans are indicated via marked days and the start→end caption
  rather than web's lane-based bar chart (timeline.ts layout is ported in
  CalendarDates.kt but the board renderer is the compact 7-column strip).
