# Starstask Phase 5 — Final Report (5C–5G)

## 1. Overall status: PARTIAL

Core additive schema for 5C–5G implemented and validated. Critical parts blocked by unresolved product decisions (invite usage policy, grading CSV, discussion scope, catalogue scope, registry mapping/activation). No production touched; no backfill; legacy NIM/tenant enforcement untouched. Nothing claims COMPLETE where blocked.

## 2. Phase 5C — Academic Structure

Migration `20261113000000_academic_structure.sql`. New: academic_years, semesters, course_offerings, enrollments, schedule_rules/instances/exceptions. Evolved: classes (+university_id/academic_unit_id/academic_year_id/semester_id/entry_year/code), courses (+university_id nullable). Gates A–H: evidence PASS, additive PASS, security PASS (RLS member-read), tests PASS (1316→1079 vitest, tsc), docs PASS. Blocker carried: catalogue scope (36#2).

## 3. Phase 5D — Enrollment + Admin

Migration `20261114000000_enrollment_admin.sql`. New: class_memberships, course_invite_tokens/acceptances, class_admin_assignments/permissions. Gates PASS except invite usage policy STOP (36#8: no approved default; columns nullable, explicit values required). Last-admin trigger, has_class_permission RPC. Legacy class_members/admins untouched.

## 4. Phase 5E — Ops

Migration `20261115000000_ops.sql`. New: attendance_meetings/records/corrections, grade_batches/entries/history. Evolved: assignments, course_materials (+university_id/offering_id). Statuses verified 5-value; not_applicable display-only (rejected by CHECK in tests). Excel/PDF export via existing app code; no CSV import. Grading CSV UNRESOLVED → infra + validate_grade_entry only. Storage: 5 buckets audited, policies unchanged.

## 5. Phase 5F — Communication

Migration `20261116000000_communication.sql`. New: announcements, announcement_reads, discussion_threads (ISOLATED). Social feed: gated, no table (ADR-016). Notifications reuse outbox (+university_id). Discussion scope UNRESOLVED → isolated proposal only.

## 6. Phase 5G — Hardening

Migration `20261117000000_hardening.sql`. audit_logs +university_id/before_state/after_state; 6 justified indexes; anon re-denial. SECURITY DEFINER: new code search_path='' hardened; legacy flagged REPORTED.

## 7. Tables (21 new + 7 evolved)

New: academic_years, semesters, course_offerings, enrollments, schedule_rules, schedule_instances, schedule_exceptions, class_memberships, course_invite_tokens, course_invite_acceptances, class_admin_assignments, class_admin_permissions, attendance_meetings, attendance_records, attendance_corrections, grade_batches, grade_entries, grade_history, announcements, announcement_reads, discussion_threads. Evolved: classes, courses, assignments, course_materials, audit_logs, notification_events, notification_deliveries. No tables dropped.

## 8. Migrations

`20261113000000_academic_structure.sql`, `20261114000000_enrollment_admin.sql`, `20261115000000_ops.sql`, `20261116000000_communication.sql`, `20261117000000_hardening.sql` (+ test `supabase/tests/phase5c-5g-validation.sql`). Applied via piped psql only (ON_ERROR_STOP=1); WIP `20261110000000` never executed. All expand-contract, deterministic, IF NOT EXISTS guarded.

## 9. Constraints / Indexes / RLS / RPC

Composite (id,university_id) supports + same-university FKs everywhere; partial uniques (one current year, one home membership, active enrollment/invite/admin, hash 64); CHECKs (statuses, dates, score range). RLS: enabled on all 21, anon revoked, authenticated SELECT-only. RPC: has_class_permission, validate_grade_entry, guard_last_class_admin trigger.

## 10. App files changed

Only types: `apps/web/src/types/database.generated.ts` (regenerated), `apps/web/src/types/database.ts` (hand sync incl. 5A/5B tables restored). No app logic/UI changed.

## 11. Storage policy

assignment-attachments/leave-evidence/verification-evidence private; avatars/class-media public — verified, unchanged. No new buckets, no policy edits.

## 12. Test results

Validation SQL: PASS. `npx tsc --noEmit`: PASS. `vitest`: 1079/1079 PASS. `eslint` on type files: PASS.

## 13. Performance / Security findings

Indexes tied to read paths; no N+1 introduced (no app changes); pagination unchanged. Security: cross-university FK + RLS tested; legacy definer search_path flagged REPORTED.

## 14. Unresolved decisions

Invite usage policy (36#8), grading CSV (36#1), discussion scope (36#3), catalogue scope (36#2), registry mapping/activation (36#7), lecturer roles (36#4), late/attempt policies.

## 15. Rollback

Per-phase drop notes in each migration-validation-report.md; all additive, child-first drops, no data loss to legacy tables.

## 16. Recommended production deployment sequence

1. Platform sign-off on ADR-002 + unresolved policies. 2) Apply 5C→5G in order via migration pipeline (never supabase db push with pending WIP). 3) Regenerate types in CI. 4) Contract step (NOT NULL flips, dual-write) as separate gated migrations.
