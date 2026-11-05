# Phase 5H — Application Readiness Report

Legacy domains stay as-is until deliberately migrated. New Phase 5A–5G domains are **DATABASE ONLY** — no Server Components, Server Actions, API routes, or shared contracts consume them (verified by `from("<table>")` and `rpc("...")` across `apps/web/src`).

| Domain                                     | Integration status                                                  | Evidence                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Authentication                             | FULLY INTEGRATED (legacy Google OAuth PKCE)                         | `auth/callback`, `lib/supabase/*`, layout/onboarding                                                                           |
| Onboarding                                 | FULLY INTEGRATED for legacy profile flow (free-text university/NIM) | `app/(onboarding)`, `profile-onboarding-form.tsx`, `api/profile/route.ts`                                                      |
| Profile retrieval                          | FULLY INTEGRATED (legacy)                                           | `lib/db/profiles.ts`, `app/api/profile/route.ts`, settings page                                                                |
| University selection                       | NOT IMPLEMENTED                                                     | No `from("universities"…)` / no `rpc("platform_upsert…")` anywhere; grep verified                                              |
| Membership management                      | DATABASE ONLY                                                       | Tables + types only; zero call sites                                                                                           |
| Academic structure (years/semesters/units) | NOT IMPLEMENTED (UI/API)                                            | types only                                                                                                                     |
| Classes / course management                | FULLY INTEGRATED (legacy)                                           | `app/api/classes/*`, `lib/db/classes.ts`, dashboards; additive columns unused                                                  |
| Enrollment                                 | NOT IMPLEMENTED (new model)                                         | `enrollments` table exists, zero call sites                                                                                    |
| Class Admin management                     | DATABASE ONLY                                                       | `class_admin_assignments`, `has_class_permission` — no call path                                                               |
| Attendance                                 | FULLY INTEGRATED (legacy) / DATABASE ONLY (new model)               | existing attendance pages/check-in use `discussion_sessions` + `attendance_meetings` legacy path; new normalized tables unused |
| Assignments                                | FULLY INTEGRATED (legacy)                                           | `app/api/assignments/*`, `lib/db/assignments.ts`; additive `university_id`/`offering_id` unused                                |
| Grading                                    | NOT IMPLEMENTED (CSV gated)                                         | schema only                                                                                                                    |
| Scheduling                                 | FULLY INTEGRATED (legacy weekly rows + PDF import)                  | `schedule*`, `class_course_schedules`; new schedule_rules not wired                                                            |
| Announcements                              | NOT IMPLEMENTED                                                     | nav/wording exists; tables unused                                                                                              |
| Discussions                                | NOT IMPLEMENTED / ISOLATED                                          | `discussion_threads` no app wiring                                                                                             |
| Notifications                              | FULLY INTEGRATED (legacy outbox)                                    | existing inbox/push pipeline; new `university_id` unused                                                                       |

## Conclusion

Application readiness for the new multi-tenant architecture is **DATABASE ONLY**. The product remains single-university-oriented in code, while the schema is multi-tenant ready behind platform control. No user page can yet select universities, enrollments, or academic structure.

## Integration seams (for 5I)

1. Shared contract: `apps/web/src/types/database.generated.ts` is current for new tables; hand `database.ts` synced but `__InternalSupabase` drift handled in 5B report — keep both.
2. `lib/supabase/server.ts` is the only sanctioned server client; all new data access must flow through it.
3. `api/` routes use Zod schemas from `@starstask/contracts`; new RPCs/tables need contracts before UI.
4. `packages/contracts` holds existing scans — extend there, not in page code.
5. No test covers new DB domains → new focused unit tests must accompany 5I integration.
