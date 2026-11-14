# Phase 5L — Function Security

## What changed (migration `20261119000000_phase5l_security_hardening.sql`)

### 1. Anon EXECUTE revoked (HIGH fix)

`REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;` then
allow-list re-grants for intentionally public helpers only:
`get_invitation_preview`, `list_discussion_sessions`, `can_view_session`,
`session_checkin_summary`, `list_assignments`, `list_classes`,
`consume_rate_limit`, `*_from_object_path` (3 path helpers).
Everything else — including all write RPCs (`apply_for_class`,
`create_class_invitation`, `assign_class_admin`, `create_class_subject`,
`create_discussion_session`, `create_attendance_meeting`,
`check_in_attendance_meeting`, `record_attendance_correction`,
`create_leave_request`, `begin_class_verification`, `update_my_profile`,
`set_class_media`, …), all read helpers (`is_platform_admin`,
`is_class_member`, `is_class_admin`, `can_manage_class`,
`is_university_member`, `has_class_permission`, `list_platform_users`,
`list_platform_classes`, `get_platform_admin_overview`,
`get_my_profile`, …), and internal helpers (`record_audit`,
`enqueue_notification_event`, …) — is no longer callable by `anon`.
`authenticated` keeps EXECUTE on all user-facing RPCs (default grants
unchanged; internal-only helpers were never granted to it beyond defaults
and remain gated by their internal `auth.uid()` checks).

Dynamic-SQL / internal helpers (`record_audit`, `enqueue_notification_event`,
`queue_session_notification`, `notify_session_participants`,
`settle_session_side_effects`, …) remain SECURITY DEFINER but are not
anon-reachable; they are invoked only from other SECDEF functions or
service_role workers.

### 2. search_path hardening (MEDIUM fix)

All SECDEF functions that had `search_path=public, pg_temp` now use
`search_path=''`, set per-OID (overloads handled). Bodies already use
public-qualified names (`public.audit_logs`, `public.class_admins`, …).
Functions whose bodies contain `EXECUTE %` (dynamic SQL) are skipped
and left at `public, pg_temp`; they are internal-only and documented
in the rollback plan.

### 3. Sensitive RPC review

| Function                                  | Why SECDEF                         | search_path | Grants after                      | Auth                                             |
| ----------------------------------------- | ---------------------------------- | ----------- | --------------------------------- | ------------------------------------------------ |
| `has_class_permission`                    | reads admin assignments across RLS | `''`        | authenticated                     | `auth.uid()` matched to assignment user/identity |
| `session_checkin_summary` (anon OK)       | derives config, never raw coords   | `''`        | anon+authenticated (allow-listed) | `can_view_session` gate                          |
| `session_checkin_summary_many` (Phase 5K) | batched derive                     | `''`        | authenticated only                | `can_view_session` per row                       |
| `validate_grade_entry`                    | pure validation                    | `''`        | authenticated                     | no data access (checks only)                     |
| `platform_upsert_student_identity`        | writes tenant data                 | `''`        | authenticated (gated)             | `is_platform_admin()` required                   |
| `.from("audit_logs").insert` (app)        | audit writes                       | —           | service_role path                 | caller verified; see below                       |

No function was converted from SECDEF to INVOKER (would break RLS
policies that deliberately call predicates to avoid recursion).

## Verification

`supabase/tests/phase5l-grants-validation.sql`:
§1 anon-on-write-RPC violations = 0; §2 public helpers still granted;
§3 no SECDEF function with `pg_temp` remains.
