# 5I-F — Assignments & Grading

**Status: PARTIALLY** (legacy preserved; grading ships as read-only status/history; CSV-dependent features blocked)

## What shipped

| File                                     | Role                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/db/grades-readonly.ts` | `listGradeBatchesForClass`, `listGradeHistoryForClass` (RLS reads, manage_grades-gated page) |
| `academic/grades/page.tsx`               | Read-only: batch status, entry/published counts, change ledger; info banner re: CSV          |
| Legacy assignments                       | **Untouched.** No query, route, or component changed                                         |

## Assignments

- Existing assignments (`assignments` + `course_materials`) keep their behavior; the additive `university_id` / `offering_id` columns from 5E remain unused — **no verified consumer exists yet**, so no wiring was invented.
- Class-announcement-as-assignment flow (`content_type = 'class_announcement'`) untouched; the new `announcements` table is a separate, formal surface (see announcements-notifications.md).
- Offering linkage will activate when offerings actually exist (post-activation); at that point assignments can be filtered/reported per offering without schema change.

## Grading

- **Read-only batch status** (uploaded/verifying/published, entries, published counts, uploader) — visible to `manage_grades` holders (and platform admins) only; RLS alone would allow any university member, so the page adds the permission gate deliberately.
- **Read-only change ledger** (`grade_history` joined to entry component; old → new score, reason, who, when).
- **Nothing publishes.** No publish button, no upload/verify action, no CSV import. The `grade_batches.status = 'published'` transition is unreachable from this app.
- **Grading CSV (decision #1) stays UNRESOLVED** → no column mapping, no importer, no validation UI, no invented format. The schema check `validate_grade_entry()` remains unused by the app.
- Grade rows for individual students are **not** displayed anywhere (batch-level aggregates only).

## Tenant isolation

Both queries key off offering ids resolved from the class row; RLS (`grade_*_member_read`: university member OR platform admin) and the page gate compose. No service-role reads on grading data.

## Not implemented (blocked)

- Grade upload/verification/publish flows (#1).
- Any assignment↔offering bulk relink (needs verified consumer + activation).
- Lecturer RBAC (#4) — `manage_grades` currently maps to class admin assignments only.
