# Shared academic calendar — StarsTask

## 1. Scope

Students and class admins use one calendar at `/schedule`. The two roles see the
same events; only the management rights differ. A class admin manages official
events for their own class group, and nobody manages another group's events.

The calendar keeps one row per source instead of copying everything into a
single events table:

| Source                  | Stored in                  | Managed by          | App event type   |
| ----------------------- | -------------------------- | ------------------- | ---------------- |
| Assignment deadlines    | `assignments.deadline`     | Assignment workflow | `assignment`     |
| Discussion sessions     | `discussion_sessions`      | Session workflow    | `class_schedule` |
| Weekly course timetable | `class_course_schedules`   | Class admin         | `class_schedule` |
| Exams                   | `class_calendar_events`    | Class admin         | `exam`           |
| Academic events         | `class_calendar_events`    | Class admin         | `academic_event` |
| One-off class meetings  | `class_calendar_events`    | Class admin         | `class_schedule` |
| Personal events         | `personal_calendar_events` | The owner           | `personal`       |

Assignment deadlines are never duplicated. Editing or withdrawing an assignment
changes the calendar on the next render because the deadline is read live.

## 2. Permissions

| Capability                                | Student | Class admin | Other group |
| ----------------------------------------- | ------- | ----------- | ----------- |
| View the shared calendar and class events | Yes     | Yes         | No          |
| View assignment deadlines and sessions    | Yes     | Yes         | No          |
| Create / edit / delete personal events    | Own     | Own         | Own only    |
| Create / edit / cancel official events    | No      | Own class   | No          |
| Maintain the recurring weekly timetable   | No      | Own class   | No          |
| Manage another class group                | No      | No          | No          |

The server resolves the identity from the session, not from a submitted user id.
Row Level Security repeats every rule in the database: personal events are
owner-only, class events are readable by class members, and writable only by
`is_class_admin(class_id)` or a platform admin. The weekly timetable now follows
the same admin-only write rule.

## 3. Lifecycle

1. **Create** — the form validates dates, times, timezone, and class access, then
   the API validates the same body with the shared contract.
2. **Publish** — new events start as `published` and are immediately visible to
   the class group.
3. **Update / cancel** — an edit replaces the fields. Cancelling sets
   `cancelled` while keeping the row visible and struck through. Both changes
   appear to group members on their next load.
4. **Archive** — archiving sets `archived`, which hides the event from the
   calendar but preserves it on record. Official events are archived, not hard
   deleted. A personal event belongs to its owner and can be deleted outright.

## 4. Data model

`personal_calendar_events`

- `id`, `user_id`, `title`, `description`, `starts_at`, `ends_at`, `time_zone`,
  `location`, `status`, `created_at`, `updated_at`.
- Status: `published`, `cancelled`, `archived`.
- RLS: the owner only, for every operation.

`class_calendar_events`

- `id`, `class_id`, `subject_id`, `title`, `description`, `event_type`,
  `starts_at`, `ends_at`, `time_zone`, `location`, `visibility`, `status`,
  `created_by`, `created_at`, `updated_at`.
- `event_type`: `class_schedule`, `exam`, `academic_event`. Assignment
  deadlines and discussion sessions are intentionally absent.
- A trigger rejects a subject that belongs to another class.
- RLS: members read; class admins write.

`class_course_schedules` keeps its weekly definition (`day_of_week`, wall-clock
start/end, room, lecturer). The calendar expands each row into dated occurrences
for the visible days, so one edit changes every future week.

Instants are stored as `timestamptz`; the app groups and displays them in
Asia/Jakarta (WIB).

## 5. Views and filters

- **Month** — six-week Monday-first grid.
- **Week** — Monday to Sunday columns.
- **Day** — chronological rows.
- **Agenda** — the next thirty days, grouped by day.

Filters: all events, class schedule, assignments, exams, academic events,
personal events; plus class and subject. A subject filter excludes discussion
sessions and personal events because neither carries a subject.

## 6. Code map

| Piece               | Location                                                                                |
| ------------------- | --------------------------------------------------------------------------------------- |
| Migration and RLS   | `supabase/migrations/20261029003900_academic_calendar.sql`                              |
| Contracts           | `packages/contracts/src/calendar.ts`                                                    |
| Range / recurrence  | `packages/shared/src/calendar.ts`                                                       |
| Aggregation         | `apps/web/src/lib/db/calendar.ts`                                                       |
| Mutations           | `apps/web/src/lib/db/calendar-events.ts`                                                |
| API                 | `apps/web/src/app/api/calendar/**`, `…/api/classes/[slug]/calendar-events/**`           |
| Page and components | `apps/web/src/app/(workspace)/schedule/page.tsx`, `apps/web/src/components/schedule/**` |

## 7. Deployment

The migration file is committed. Applying it to the live Supabase project is a
separate, owner-authorized step (`pnpm db:push`). Until it is applied, the new
tables do not exist and `/schedule` returns an error while the rest of the app
continues to work.

No seed data or backfill is required. Existing discussion sessions, assignment
deadlines, and weekly timetable rows appear automatically.

## 8. Known limitations

- A single week of a recurring timetable cannot be overridden; change the slot
  or add a one-off class meeting.
- The weekly timetable is edited on the class page, not inside the calendar
  dialog.
- The calendar does not send notifications for official events yet.
- Archived events are preserved in the database but are not listed in the UI.
