# Phase 5L — RLS Validation

Migration: `20261119000000_phase5l_security_hardening.sql` (additive).
No tenant-table RLS policy was changed. The existing model was verified
as correct and left intact:

- `universities`: `SELECT TO authenticated USING (status='active')`.
- `university_memberships`: `SELECT TO authenticated USING (user_id = auth.uid())`.
- `academic_units` / `student_identities`: member-or-platform reads.
- Phase-5 tenant tables: `SELECT TO authenticated USING (is_university_member(university_id) OR is_platform_admin())`
  with exceptions for class-scoped reads
  (`course_offerings_member_read`, `class_admin_assignments_member_read`,
  `announcements`, `discussion_threads`).
- No `INSERT`/`UPDATE`/`DELETE` policies exist on Phase-5 tables
  (SELECT-only grants + no write policy = writes denied at two layers).

## USING / WITH CHECK review

- All Phase-5 policies are `SELECT`-only, so `WITH CHECK` is N/A.
- Legacy write policies (assignments, attachments, class_subjects,
  class_subject_members, leave, push) all use owner-or-manager
  `USING` + `WITH CHECK` with `auth.uid()`-anchored predicates.
- No policy grants based on authentication alone.

## Change made

- `course_invite_tokens`: `course_invite_tokens_member_read`
  (any university member could read token hashes) replaced by
  `course_invite_tokens_admin_read`:
  `is_platform_admin() OR EXISTS(course_offerings.id = offering_id AND is_class_admin(class_id))`.

## Verification

`supabase/tests/phase5l-grants-validation.sql` §6 confirms the new policy.
`supabase/tests/phase5l-tenant-isolation-validation.sql` covers CRUD
separately (SELECT/INSERT/UPDATE/DELETE) for tenant tables.
