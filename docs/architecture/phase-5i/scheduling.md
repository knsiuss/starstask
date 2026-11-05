# 5I-G — Scheduling (Normalized Model)

**Status: COMPLETE** (read-only, timezone-aware; legacy schedule untouched; no PDF import)

## What shipped

| File                                       | Role                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/db/schedule-readonly.ts` | Rules / instances / exceptions for the class's offerings (one batched query each)                                                                     |
| `apps/web/src/lib/utils/timezone.ts`       | `resolveTimeZone` (UTC fallback), `formatInTimeZone` (zone label always printed), `weekdayName`, `formatTimeWindow` — pure, tested                    |
| `academic/schedule/page.tsx`               | Rules table (weekday, window, room, zone), instances table (latest 200, in rule timezone, exception marker), exceptions list (cancel/move/substitute) |
| `apps/web/tests/unit/timezone.test.ts`     | 9 tests                                                                                                                                               |

## Per requirement

- **Offerings ↔ rules ↔ instances ↔ exceptions:** joined via offering ids of the class; exceptions attach to instances and are surfaced both inline ("overridden") and as their own list.
- **Timezone-aware display:** instance times render via `Intl.DateTimeFormat` in the rule's stored `timezone` with the zone printed (`15/01/2026, 07:30 (Asia/Jakarta)`); invalid/missing zones fall back to UTC, never to the viewer's locale guess. The class university's timezone is surfaced on the attendance page for meeting creation review.
- **No PDF import:** nothing imports PDF; no import path was added (legacy PDF import is untouched and remains the only import mechanism, owned by legacy flows).
- **Legacy preserved:** `class_course_schedules` and all `schedule*` routes/components/pages are byte-identical; the new view is additive under `/academic/schedule`.

## Read scope

Member-visible under RLS (`schedule_rules|instances|exceptions_member_read`: university member OR platform admin) — page additionally uses `resolveClassMemberForPage` (legacy class member, any new-model permission, or platform admin) and requires a linked class. Unlinked classes render the standard notice.

## Not implemented (by design)

- Rule/instance creation or editing (no policy published; operator-managed; **no** write endpoints exist).
- RRULE expansion or instance materialisation (belongs to an operator/worker process, not the web app).
- Calendar sync for the new model (Google Calendar integration remains legacy-only).
