# Phase 5L — Security Inventory

Date: 2026-11-05 · Evidence: local Supabase (disposable) + migration source review.

## Scope
79 public tables (78 + `audit` evolutions), 147 SECURITY DEFINER functions, 108 public RLS policies, 18 storage policies, 5 buckets.

## Tables checked (tenant focus)
`universities`, `university_memberships`, `profiles`, `academic_units`,
`academic_years`, `semesters`, `courses`, `course_offerings`, `enrollments`,
`classes`, `class_memberships`, `class_admin_assignments`, `assignments`,
`attendance_meetings`, `attendance_records`, `attendance_corrections`,
`grade_batches`, `grade_entries`, `announcements`, `discussion_threads`,
`notifications` (`notification_events` + `notification_deliveries`),
`audit_logs`, plus legacy tables (`class_members`, `class_admins`,
`leave_requests`, `discussion_sessions`, `course_materials`, …).

- Every table has RLS enabled (0 tables without RLS — verified live).
- Tenant tables (`academic_years`, `semesters`, `course_offerings`,
  `enrollments`, `schedule_*`, `class_memberships`, `course_invite_*`,
  `class_admin_*`, `attendance_*`, `grade_*`, `announcements`,
  `discussion_threads`) are SELECT-only for `authenticated`
  (`is_university_member(university_id) OR is_platform_admin()`).
  Writes are service_role-only by design.
- `is_university_member` requires `status='active'` (suspended /
  graduated / pending members are denied by construction).

## SECURITY DEFINER functions
147 total, 0 without a `search_path` setting. Predicates
(`is_platform_admin`, `is_class_member`, `is_class_admin`,
`is_university_member`, `has_class_permission`,
`can_view_session`, …) already use `search_path=''`.
~100 state-changing RPCs (`create_*`, `update_*`, `record_*`,
`check_in_*`, …) ran with `search_path=public, pg_temp`.

## Grants (pre-fix, live)
67 functions were EXECUTE-able by `anon` via Supabase default privileges.
Only 2 revokes existed (`create_or_get_course`,
`register_push_subscription` — see `20261029000800_function_grants.sql`).
Internal `auth.uid()` checks refused anonymous callers, but the grants
should not exist.

## Storage
| bucket | public | read policy |
|---|---|---|
| `assignment-attachments` | false | authenticated, owner or published |
| `leave-evidence` | false | owner or leave reviewer |
| `verification-evidence` | false | owner or verification viewer |
| `avatars` | true | anon+authenticated (intentional public asset) |
| `class-media` | true | anon+authenticated read; writes class-admin scoped |

`class-media` / `avatars` public reads cross universities by design
(class identity images). Writes are scoped to the owning class.

## Findings
- **HIGH** — anon EXECUTE on ~40 state-changing RPCs (default grants).
- **HIGH** — `course_invite_tokens_member_read`: any university member
  could SELECT `token_hash` rows.
- **MEDIUM** — `audit_logs` append-only was convention-only (no mutation
  trigger; service_role bypasses RLS).
- **MEDIUM** — `search_path=public, pg_temp` on ~100 SECDEF functions
  (pg_temp shadow risk).
- **LOW** — `is_university_member` EXECUTE-able by anon (harmless, returns false).
- **INFO** — public `avatars` / `class-media` reads.
