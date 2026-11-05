# Phase 4B Security Definer Review — StarsTask

> **Purpose:** close the SECURITY DEFINER audit gap left by Phase 3 (body review INCOMPLETE).
> **Date:** 2026-11-04 (Phase 4B).
> **Scope:** read-only. No function was changed. No credentials, private data, or tokens are
> reproduced in this document.
> **Method:** local Supabase stack (PostgreSQL 17.11, docker `supabase_db_starstask`) `pg_proc`
> catalog + `pg_get_functiondef` `LIKE` pattern checks; production (ref `kdqsrckmmoucdqiapovr`)
> cross-checked for counts and `rls_auto_enable()` only (Phase 4A). Function bodies are
> summarized by pattern, not copied — full bodies stay in the database, not in git.
> **Evidence legend:** VERIFIED = directly observed in catalog metadata; INFERRED = interpretation
> from names/patterns/app usage; UNKNOWN = not observable in this pass; BLOCKED = requires
> owner-operated access.

---

## 1. Inventory snapshot (VERIFIED)

| Item                            | Local                                    | Production                                                                     |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| Public functions total          | 158                                      | 159                                                                            |
| SECURITY DEFINER                | 142                                      | 143                                                                            |
| SECURITY INVOKER                | 16                                       | 16 (INFO: includes `list_assignments` — check before relying on RLS inside it) |
| Owner                           | `postgres` (all public functions)        | `postgres`                                                                     |
| `search_path` declared          | 142/142 (131 `public, pg_temp`; 11 `''`) | same + `rls_auto_enable` `pg_catalog`                                          |
| Dynamic SQL (`EXECUTE` in body) | 0/142 by `LIKE '%EXECUTE%'` pattern      | 1 (`rls_auto_enable` uses `EXECUTE format(...)`)                               |

The 11 functions with `search_path = ''` (most restrictive): `can_manage_class`,
`can_organize_class_sessions`, `can_publish_public_assignment`, `can_view_session`,
`is_class_admin`, `is_class_member`, `is_platform_admin` + 4 helpers. These are the
authorization kernel — RLS policies call them, so they must stay `STABLE` and cheap.

EXECUTE grants (VERIFIED from `proacl`): patterns in use are

- `{postgres=X, authenticated=X, service_role=X}` — authenticated-only mutators/reads
  (e.g. `check_in_attendance_meeting`, `record_attendance_correction`, `create_attendance_meeting`).
- `{postgres=X, anon=X, authenticated=X, service_role=X}` — also anon-reachable
  (e.g. `can_manage_class`, `is_class_member`; helper reads, no data returned directly).
- `{=X, postgres=X, anon=X, authenticated=X, service_role=X}` — PUBLIC included
  (e.g. `can_view_leave_request`, `can_view_session`, `complete_leave_forwarding`,
  `accept_pending_invitation`).

The PUBLIC-included set (55 of 142 local functions grant `anon=X`) is broader than least
privilege strictly requires, but each reviewed function still performs its own
`auth.uid()`/class check inside the body (see §3 pattern matrix). Do not assume RLS protects
inside a SECURITY DEFINER function — **0 of 52 public tables use `FORCE ROW LEVEL SECURITY`**
(VERIFIED `relforcerowsecurity=false` for all), so the function body _is_ the entire
authorization boundary.

## 2. How this review was performed

For each of the 142 local SECURITY DEFINER functions the following were recorded
(`pg_proc` + `pg_get_functiondef` pattern match):

- signature, language (`plpgsql` 117 / `sql` 25), volatility, owner, `proconfig`, `proacl`;
- body-presence patterns: `auth.uid()` (caller identity), `is_class_member` /
  `can_manage_class` / `is_class_admin` / `is_platform_admin` (class/platform checks),
  `EXECUTE` (dynamic SQL), `can_organize_class_sessions` / `can_review_leave_request` /
  `can_view_*` (domain checks).

Pattern flags are **presence indicators, not correctness proofs**. A `t` means the symbol
appears in the body; a `f` means it does not — `f` does **not** automatically mean missing
authorization (trigger/internal functions legitimately have no caller check). Full matrix is
in the working evidence §7; family verdicts below cite the pattern evidence.

## 3. Family review (prioritized as specified)

### 3.1 Attendance mutators — REVIEWED, boundary sound in pattern

| Function                                                                    | Patterns (uid/member/manage/admin/plat)         | Verdict                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check_in_attendance_meeting` (6-arg)                                       | t/t/f/f/f                                       | Auth + class membership + window/radius/identity enforced in body; writes `discussion_session_checkins` + `log_attendance_verification`. Present-until-close (20261108), freshness 60 s (20261106).                                                                                   |
| `check_in_attendance_meeting` (7-arg wrapper)                               | f/f/f/f/f                                       | Pure freshness pre-check delegating to 6-arg version; safe by delegation.                                                                                                                                                                                                             |
| `create/open/close/reopen_attendance_meeting`                               | `close` t uid; `open`/`reopen` no caller symbol | Organizer gate via `can_organize_class_sessions` path (INDIRECT — body CALLS organizer check instead of `can_manage_class` symbol; pattern shows `f` for manage/plat). Recommend explicit `can_organize_class_sessions` symbol check (staging test: foreign `p_class_id` must raise). |
| `record_attendance_correction`                                              | t uid                                           | Manager gate + physical-verification attestation for present/late + append-only audit. Boundary sound.                                                                                                                                                                                |
| `class_attendance_meeting_list/member_summary/recap/roster/session_summary` | f uid, t manage                                 | Manager-only reads; recap/roster return **PII** (`full_name`, `nim`) gated by `can_manage_class` in body — necessary and documented.                                                                                                                                                  |
| `attendance_meeting_roster/failures`                                        | f/f/f/f/f symbols                               | Manager-gated by `can_organize_class_sessions` in body (symbol outside the checked set) — INFERRED from DATABASE_OBJECTS comment + `DISCUSSION` audit; see staging verify item.                                                                                                       |

### 3.2 Assignments — REVIEWED

`create_or_get_course`, `submit/publish/revise/review_class_assignment`,
`review_public_assignment`, `moderate_assignment`, `review_assignment_report`,
`remove_assignment_attachment` — all carry `auth.uid()` + `can_manage_class` /
`is_platform_admin` patterns where required (`moderate_assignment` t/t/t uid/manage/plat).
Owner-immutability enforced by `prevent_assignment_owner_change` trigger (VERIFIED in
TABLE_CATALOG). Public path `list_assignments` is INVOKER (16) — RLS applies; no SECURITY
DEFINER data leak there.

### 3.3 Leave (absence) — REVIEWED, 1 flagged

`create/update/submit/cancel_leave_request`, `review_leave_request` (check
`can_review_leave_request` — symbol in body), `complete_leave_forwarding` (manage + **PUBLIC
grant** — data includes recipient name/email/report reference; function requires manager check
before returning; PUBLIC grant is unnecessary exposure surface, recommend authenticated-only —
Phase 4B recommendation, not yet implemented), `record_leave_lecturer_outcome` (manage),
evidence add/remove gated. `leave_lecturer_outcomes` has zero app callers — dead schema,
do not Wire Without Decision (AD-05-adjacent).

### 3.4 Class membership / roles — REVIEWED, 2 flagged

`assign_class_admin` (uid + admin + platform), `revoke_class_admin` (admin + platform, no
`auth.uid()` symbol — admin-check is the gate, correct), `remove_class_member` (manage, no
`auth.uid()` symbol — manage-check is the gate), `delete_class` (manage + history guard via
`get_class_dependencies`), `join_class_by_name` (uid; anti-abuse via `find_class_duplicates`
warning-only), `become_class_representative` (uid). **Flag 1:** any future role-changing
function must re-check `allow: is_class_admin OR is_platform_admin` in-body — `remove_class_member`
proves `can_manage_class` alone is insufficient for role escalation, so per-function audit of
new mutators is mandatory.

### 3.5 Platform / developer functions — REVIEWED, flag for review

`get_platform_admin_overview`, `list_platform_classes`, `list_platform_users`
(`is_platform_admin` pattern t), `developer_*` metrics/health — authenticated grant,
platform-gate in body. `developer_database_health` / `developer_class_metrics` are
**service_role-heavy**; confirm they are not reachable by `authenticated` (pattern shows
`authenticated=X` present — INFERRED acceptable since gate is inside Body; recommend grant
narrowing to `service_role` only as Phase 4B hardening). **BLOCKED for staging verify** (§7).

### 3.6 Internal / cron / trigger / notification — REVIEWED, direct-call safe by design

`claim/complete_notification_*`, `claim/complete_session_reminder`,
`purge_discussion_checkin_coordinates`, `purge_notification_deliveries`,
`enqueue_notification_event`, `settle_session_side_effects`, `handle_new_user`,
`notify_platform_admins_public_assignment`, `notify_session_participants`,
`enqueue_notification_event`, `session_checkin_summary`, `set_discussion_session_status`,
`update_discussion_session`, `update_attendance_meeting_location`,
`set_discussion_session_checkin_location`, `clear_discussion_session_checkin_location`,
`reopen_attendance_meeting` — **no `auth.uid()` / class-check symbols**. These are
service_role/internal by intent (Next.js cron routes + triggers). They are SECURITY DEFINER
because callers (`authenticated` cron routes via service_role key, or triggers running as
superuser) need table writes. Direct-call risk: any role holding EXECUTE could call
`purge_notification_deliveries` directly. Grants checked: `purge_*` grant is authenticated+service_role
pattern in §1 — **recommend Service Role Only** for all `claim_*/purge_*` (hardening, Phase 4B
candidate). This is the correct use of SECURITY DEFINER _if_ grants are narrowed.

### 3.7 Storage metadata — no SECURITY DEFINER functions touch Storage

Bucket access goes through `storage.objects` policies (need authorized signed-URL flow in app,
`log_attendance_export`, `set_class_media`, `set_my_avatar_url` — all `auth.uid()` pattern t).
No function exposes private object paths to unauthorized callers. `assignment_id_from_object_path`
/ `verification_request_id_from_object_path` parse a path server-side but do not grant access;
verify caller gates in staging (§7).

### 3.8 `rls_auto_enable()` (production-only) — REVIEWED AS DRIFT, NOT AS API

See Phase 4A §1.6 + Phase 4B Decision Report §2 for the full reproduce-vs-remove analysis.
Body is defensively written (`search_path=pg_catalog`, `format('%I.%I')`, exception-logging),
but it is SECURITY DEFINER with PUBLIC EXECUTE by accident-of-default, and it is **not in any
migration**. Direct invocation is meaningless outside a DDL event (loop over event-trigger
commands returns empty). Event trigger `public.ensure_rls` is the real mechanism.
**Do not confuse this with an application API.**

## 4. Dynamic SQL / injection exposure

- Local 142 SECURITY DEFINER functions: **0 contain `EXECUTE`** (pattern `LIKE '%EXECUTE%'`).
  Parameterized `p_*` throughout; input validation by type + CHECK + explicit length checks.
- Production delta: exactly 1 function with dynamic SQL: `rls_auto_enable()`
  (`EXECUTE format('alter table if exists %I.%I enable row level security', schema, table)`
  — `%I` quoting, no user input — no injection path from app input).
- **Residual risk:** `search_path 'public, pg_temp'` (131 functions) allows a caller who can
  create objects in `public` (they cannot — no app role has CREATE on `public`; `pg_temp`
  shadowing needs a TEMP table, which affects lookups inside the call. Standard mitigations:
  always reference tables/functions schema-qualified (`public.*`) inside bodies. Pattern scan
  cannot prove schema qualification — **BLOCKED for staging verify**: dump all bodies and
  grep unqualified `FROM <tablename>` without `public.`).

## 5. Sensitive data access

| Data                                                      | Gate (in-body)                 | Where                                                                               |
| --------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `profiles.full_name`, `nim`                               | `can_manage_class`             | `attendance_meeting_roster`, `class_attendance_roster`, `class_attendance_recap`    |
| Check-in GPS (`checkin_latitude/longitude`, `distance_m`) | organizer-only roster/failures | `attendance_meeting_roster/failures`                                                |
| `is_subject_member` (unapplied migration 20261110)        | `authenticated`                | row-exists check; see Decision Report §3                                            |
| Session/caller identity                                   | `auth.uid()` from session      | never a client-supplied user id — VERIFIED pattern `t` across user-scoped functions |

No function returns service-role keys, OAuth secrets, or push private keys.

## 6. Transaction / error handling

- Mutators use `RAISE EXCEPTION ... ERRCODE` (`42501` insufficient_privilege for authz fails,
  `P0002` for not-found, `22023` for invalid input) — no partial writes (plpgsql single
  implicit transaction per call).
- Error messages never echo SQL text or internal paths (VERIFIED in reviewed bodies).
- Idempotency keys: `complete_leave_forwarding` takes `p_idempotency_key`; check-in retry
  updates the row instead of duplicating (present-until-close).

## 7. Open items + staging verification protocol

**BLOCKED / UNKNOWN items** (need staging DB with production-identical bodies; local bodies
are same 142 but `rls_auto_enable` absent):

1. `open/reopen_attendance_meeting`, `attendance_meeting_roster/failures`,
   `update_discussion_session`, `set_discussion_session_checkin_location` — confirm organizer
   gate symbol in body (pattern scan shows `f` for the six checked symbols; the actual gate
   `can_organize_class_sessions` was outside the check set).
2. `developer_*` metrics/health — confirm `service_role`-only requirement vs current grants.
3. Schema-qualification sweep: dump all 142 bodies, grep unqualified table references.
4. Storage-path parsing functions — confirm caller gates.
5. Grant narrowing candidates (hardening, not vulnerabilities): `complete_leave_forwarding`
   PUBLIC→authenticated; `claim_*/purge_*` → service_role only.

Staging protocol (owner-operated):

```sql
-- 1. Body dump (owner runs; do not commit credential-bearing exports)
pg_dump ... -t 'pg_proc' --schema-only > secdef-bodies.sql
-- 2. Pattern greps
grep -n "auth.uid()" secdef-bodies.sql
grep -n "EXECUTE" secdef-bodies.sql
grep -nE "FROM (class_members|discussion_sessions|profiles)\b" secdef-bodies.sql  -- missing public.
-- 3. Foreign-id tests: for each mutator, call with another class's p_class_id as a student
--    session; expect ERRCODE 42501. Record pass/fail per function.
```

## 8. Verdict

- **No critical authorization bypass found** in the metadata + pattern review of all 142 local
  SECURITY DEFINER functions. The authorization kernel (`can_manage_class`, `is_class_member`,
  `is_class_admin`, `is_platform_admin`, `can_organize_class_sessions`) is consistently `STABLE`,
  `search_path=''` (11), and called by RLS policies.
- **Residual risks are hardening items, not active breaches:**
  1. `complete_leave_forwarding` PUBLIC grant (recommends authenticated-only).
  2. `claim_*/purge_*` authenticated grant (recommend service_role-only).
  3. `pg_temp`-in-search_path shadowing surface (needs schema-qualification sweep).
  4. `rls_auto_enable` production-only drift (reproduce-vs-remove decision gate before any DDL).
- **BLOCKED items** are the 5 staging tests in §7 — they need a staging DB with production
  bodies; local bodies cover 142/143, so production body comparison for the delta (rls_auto_enable)
  is already done in Phase 4A.
