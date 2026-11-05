# StarsTask Database Schema Reference

> **Purpose:** complete, evidence-based technical reference of the current StarsTask PostgreSQL database,
> prepared before any standardization, refactoring, performance or multi-tenant work.
> **Type:** READ-ONLY. No DDL, migration, policy, function, bucket or data change was made to produce this document.
> **Generated:** 2026-11-04.
> **Sources (in priority order):**
>
> 1. PostgreSQL catalog dumps from the local Supabase stack (PostgreSQL 17.11, database `postgres`, 17 MB) —
>    read-only `COPY (... pg_catalog ...) TO STDOUT` queries listed in §17, plus per-table `SELECT count(*)`.
> 2. Remote production cross-checks (Supabase project `starstask`, ref `kdqsrckmmoucdqiapovr`, ap-northeast-2,
>    PostgreSQL 17.11) via read-only MCP `execute_sql` for counts, estimates and the function delta in §10.
> 3. Phase 3 audits in `docs/database/audit/*` and `docs/database/architecture/*` (cited per section as "Phase 3: …").
> 4. Application source (`apps/web/src`, `packages/*`) for dependency mapping (§14) — read-only grep, no files modified.
>
> **Evidence legend:** VERIFIED = directly confirmed from database metadata; INFERRED = interpretation from
> schema / application usage; UNKNOWN = insufficient evidence; NOT APPLICABLE = does not apply.
>
> **File map (this directory):**
>
> - [TABLE_CATALOG.md](./TABLE_CATALOG.md) — every public table, sizes, row counts, constraints, indexes, RLS, triggers (§3).
> - [COLUMN_DICTIONARY.md](./COLUMN_DICTIONARY.md) — every column of every table (§4).
> - [DATABASE_RELATIONSHIPS.md](./DATABASE_RELATIONSHIPS.md) — full FK mapping + domain ER diagrams (§5).
> - [INDEX_CATALOG.md](./INDEX_CATALOG.md) — every index + duplicate/FK-coverage analysis (§6).
> - [DATABASE_NAMING_AUDIT.md](./DATABASE_NAMING_AUDIT.md) — naming convention audit + issue inventory (§7).
> - [DATABASE_DOMAIN_MAP.md](./DATABASE_DOMAIN_MAP.md) — domain/entity classification (§8).
> - [RLS_POLICIES.md](./RLS_POLICIES.md) — verbatim `pg_policies` dump (public + storage) (§9).
> - [DATABASE_OBJECTS.md](./DATABASE_OBJECTS.md) — functions, triggers, views, types, extensions, sequences, pg_cron (§10).

---

## 1. How to read this document

Numbers in **§2** are VERIFIED from the dumps unless marked ESTIMATE. Where local and production disagree
(local stack is seeded/empty; production has real data) both values are shown and labeled. Phase 3 audit
findings are referenced, not re-asserted: a claim is only repeated here when the current dumps re-confirm it
or it is explicitly attributed to the audit (e.g. measured `pg_stat` seq scans, which depend on live traffic
and therefore cannot be reproduced from a fresh local stack).

## 2. Database overview

| Item                                     | Value                                                                                                                                                                                                                                         | Evidence                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| PostgreSQL version (local + remote)      | 17.11                                                                                                                                                                                                                                         | VERIFIED (`version()`)                                                                 |
| Database size (local)                    | 17 MB (17,528,499 bytes)                                                                                                                                                                                                                      | VERIFIED (`pg_database_size`)                                                          |
| Migrations applied (local + remote)      | 82, latest `20261109000000_checkin_message_no_numbers.sql`                                                                                                                                                                                    | VERIFIED (`supabase_migrations.schema_migrations`)                                     |
| Schemas with user objects                | `public`, `auth`, `storage`, `graphql`, `graphql_public`, `realtime`, `supabase_migrations`, `supabase_functions`, `extensions`, `pg_stat_statements` etc. (full list: `schemas.csv`)                                                         | VERIFIED (`pg_class`/`pg_namespace`; see [DATABASE_OBJECTS.md](./DATABASE_OBJECTS.md)) |
| Public tables                            | 52                                                                                                                                                                                                                                            | VERIFIED                                                                               |
| Public views / materialized views        | 0 / 0                                                                                                                                                                                                                                         | VERIFIED — app "views" are RPCs returning `TABLE(...)` (INFERRED from app code, §14)   |
| Public functions (local / remote)        | 158 / 159                                                                                                                                                                                                                                     | VERIFIED; delta = `rls_auto_enable()` exists only in production (§10)                  |
| Public triggers                          | 40                                                                                                                                                                                                                                            | VERIFIED (non-internal)                                                                |
| Foreign keys (public)                    | 112                                                                                                                                                                                                                                           | VERIFIED (`pg_constraint` contype=f)                                                   |
| Primary keys (public)                    | 52 (one per table; no table lacks a PK)                                                                                                                                                                                                       | VERIFIED                                                                               |
| Unique constraints (public)              | 18 (exact)                                                                                                                                                                                                                                    | VERIFIED (`pg_constraint` contype=u)                                                   |
| Check constraints (public)               | 250 (exact; 432 public constraints total = 52 PK + 18 unique + 250 check + 112 FK)                                                                                                                                                            | VERIFIED                                                                               |
| Indexes (public)                         | 175                                                                                                                                                                                                                                           | VERIFIED                                                                               |
| RLS-enabled public tables                | 52 / 52                                                                                                                                                                                                                                       | VERIFIED (`relrowsecurity`) — matches Phase 3 RLS_SECURITY_AUDIT                       |
| RLS-forced public tables                 | 0 (FORCE ROW LEVEL SECURITY is not used; see §9)                                                                                                                                                                                              | VERIFIED (`relforcerowsecurity=false` for all)                                         |
| RLS policies (public / storage)          | 83 / 18                                                                                                                                                                                                                                       | VERIFIED (`pg_policies`) — matches Phase 3 RLS_SECURITY_AUDIT                          |
| SECURITY DEFINER functions (public)      | 142 local / 143 remote                                                                                                                                                                                                                        | VERIFIED (`prosecdef`) — see §10 caveat                                                |
| Enum / composite / domain types (public) | 52 composite types (`typtype=c`) — all automatically generated table row types, one per table; 52 auto array types (`typtype=b`); **0 user-defined composite, 0 enum, 0 domain types** in `public` — statuses are CHECK-constrained text (§7) | VERIFIED (`pg_type`, both environments)                                                |
| Extensions (local)                       | 5: `pg_stat_statements` 1.11, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1, `uuid-ossp` 1.1                                                                                                                                          | VERIFIED (`pg_extension`, detail in DATABASE_OBJECTS)                                  |
| Sequences (all schemas, non-system)      | 8                                                                                                                                                                                                                                             | VERIFIED (`pg_class` relkind=S)                                                        |
| Storage buckets                          | 5 (`assignment-attachments`, `avatars`, `class-media`, `leave-evidence`, `verification-evidence`)                                                                                                                                             | VERIFIED (`storage.buckets`) — detail in §11                                           |
| `pg_cron`                                | NOT installed (no `cron` schema, no `pg_cron` extension, locally and remotely)                                                                                                                                                                | VERIFIED — scheduling is via Next.js API cron routes (§10)                             |

> **Migration gap (VERIFIED):** the repo has 83 migration files but only 82 applied anywhere —
> `20261110000000_subject_enrollment.sql` exists in `supabase/migrations/` yet is absent from
> `schema_migrations` in both the local stack and production. It is unapplied, unpushed work
> (working tree also shows unrelated modifications in `apps/web/src/components/actions/absences-tab.tsx`
> and `apps/web/src/lib/db/leave.ts` — pre-existing, untouched by this task).

> **Local vs production counts:** the local stack is seeded/near-empty, so its row counts and sizes
> describe an empty schema, not production volume. Production volumes are only available as
> `reltuples` estimates (marked ESTIMATE wherever used).

Row-count snapshot (VERIFIED local actual / ESTIMATE remote `reltuples`): local stack is effectively empty
(all public tables 0 rows except `courses` = 6 seed rows). Production estimates: `profiles` 26,
`class_members` 23, `class_subjects` 10, `classes` 4, `assignments` 2, `discussion_session_checkins` 121,
`attendance_correction_audits` 87, `attendance_verification_attempts` 51, `audit_logs` 273,
`app_error_events` 172, `rate_limits` 91; remaining 41 tables estimate 0. `discussion_sessions` estimates 0
while check-ins estimate 121 — the estimate is stale/never-analyzed, so it is unreliable for that table
(UNKNOWN exact; Phase 3 recorded 14 sessions with 129 check-ins on 2026-11-04).

Full per-table numbers: [TABLE_CATALOG.md](./TABLE_CATALOG.md).

## 3. Complete table inventory

52 public tables, all VERIFIED in [TABLE_CATALOG.md](./TABLE_CATALOG.md) with per-table: schema, name,
local actual rows, remote estimated rows, total/table size (local), PK, FKs, unique and check constraints,
indexes (with `pg_get_indexdef`), RLS enabled/forced, policy count + names, triggers, and comments.
Headline facts:

- Every public table has RLS enabled; none has RLS FORCED (VERIFIED). Consequence: table owners and
  `SECURITY DEFINER` paths bypass RLS — authorization depends on policies + function checks, not on FORCE.
- Database comments are a real documentation layer: **37 of 52** public tables carry substantive
  `obj_description` comments (VERIFIED; full text in TABLE_CATALOG), mostly stating the table's role and
  its security/retention contract (e.g. "Never contains email, NIM…", "Append-only…"). The 15 without
  comments are listed in TABLE_CATALOG. 34 public columns carry `col_description` comments (VERIFIED).
- Local sizes are small (largest tables a few hundred KiB); production growth is concentrated in `audit_logs`,
  `app_error_events`, `discussion_session_checkins` and `rate_limits` (INFERRED from remote total bytes:
  `audit_logs` ≈ 200 KiB, `assignments` ≈ 280 KiB).

## 4. Complete column-level data dictionary

All 535 public columns across 52 tables are in [COLUMN_DICTIONARY.md](./COLUMN_DICTIONARY.md), with the exact
PostgreSQL type (`format_type`), nullability, default expression, generated/identity kind, comment, PK/FK/
unique/check resolution, and a semantic-meaning column. Meaning is INFERRED from name/type/app usage except
where marked UNKNOWN in that file (mostly free-text columns with no app comment). Exact original names and
types are preserved; nothing was normalized.

Cross-cutting column facts (VERIFIED from the dump):

- `id uuid` surrogate PK on 44 of 52 public tables (VERIFIED; no integer identity PKs in public).
  The remaining 8: 4 single-column natural PKs (`rate_limits.key`, `notification_preferences.user_id`,
  `platform_admins.user_id`, `google_calendar_connections.user_id`) and 4 composite PKs
  (`class_members`, `class_admins`, `assignment_completions`, `leave_request_forwarding_items`).
- Timestamps are `timestamptz` with `*_at` naming; calendar dates use `date` with `*_date`.
- Status-like fields are `text` + CHECK constraints (not enum types) — see §7.
- Sensitive columns exist by design (`profiles.full_name`, `profiles.nim`, check-in coordinates) and are
  protected by column-level grants, not just RLS (§9, DATABASE.md §2).

## 5. Relationship and foreign key mapping

The complete 112-FK table (constraint name, source, target, ON DELETE/UPDATE decoded, deferrability) and
domain-split Mermaid ER diagrams are in [DATABASE_RELATIONSHIPS.md](./DATABASE_RELATIONSHIPS.md).

Structural facts (VERIFIED where marked):

- Cardinalities (INFERRED from FK + PK/unique structure): one-to-one `profiles.id -> auth.users.id` (shared PK);
  one-to-many `classes -> class_members / class_admins / class_subjects / discussion_sessions`,
  `assignments -> assignment_attachments`, `leave_requests -> leave_request_evidence`,
  `discussion_sessions -> discussion_session_checkins`;
  many-to-many junctions: `class_members`, `class_admins`, `class_invitation_acceptances/declines`,
  `leave_request_forwarding_items`, `saved_assignments`.
- Self-referencing FKs: none observed (VERIFIED in the local dump).
- Tables without PK: none (VERIFIED).
- Cross-schema FKs into `auth.users` are VERIFIED in the catalog dump of both environments
  (e.g. `profiles_id_fkey`, `class_members_user_id_fkey`); `auth` itself is Supabase-managed and
  outside the `public` inventory (Phase 4B correction — previously marked INFERRED).
- FK action codes (Phase 4B correction): `a` = NO ACTION, `r` = RESTRICT, `c` = CASCADE,
  `n` = SET NULL, `d` = SET DEFAULT. Distribution: ON DELETE `c` 65 / `n` 43 / `r` 4;
  ON UPDATE `a` (NO ACTION) 112 — see DATABASE_RELATIONSHIPS.md legend.
- Deferrable FKs: none observed in the local dump (VERIFIED — every row shows deferrable=false).
- FKs into sensitive academic history (`profiles`, check-ins, leave tables) are the integrity risk surface —
  see §12 for CASCADE discussion (Phase 3 SCHEMA_AUDIT P1, re-confirmed structurally here).

## 6. Index inventory

All 175 public indexes with definitions, methods, uniqueness, partial predicates and local sizes are in
[INDEX_CATALOG.md](./INDEX_CATALOG.md), including machine-checked analyses:

- Exact-duplicate column sets: none found (VERIFIED).
- Overlapping/prefix indexes and FK columns lacking a leading index: listed as HYPOTHESES only — impact is
  UNKNOWN until `EXPLAIN ANALYZE` on staging at realistic volume (Phase 3 INDEX_AUDIT reaches the same
  conclusion and additionally records measured seq-scan hot paths on `class_members`/`profiles` caused by
  per-policy `is_class_member()` calls, i.e. a function-call cost problem, not a missing-index problem).
- **This document recommends NO index creation or deletion.** Any future change needs measured evidence first.

## 7. Naming convention audit

Full audit with the issue inventory (Object / Current name / Issue / Suggested name / Reason / Risk) is in
[DATABASE_NAMING_AUDIT.md](./DATABASE_NAMING_AUDIT.md). Headline findings (INFERRED judgments on VERIFIED names):

- Conventions are largely consistent: snake_case, plural tables, `*_at` timestamps, `<entity>_id` FKs,
  `<table>_<purpose>_idx` indexes, verb-first function names.
- The one structural problem: `classes` (a cohort) vs `courses` (global catalogue) vs `class_subjects`
  (a cohort's subject) — three similar names, three different concepts (Phase 3 SCHEMA_AUDIT P1).
  Suggested direction is a docs-first rename plan before any DDL; no rename is proposed as an immediate action.
- Secondary issues: dual purpose of `discussion_sessions`; triple scope FKs on `assignments`;
  `classes.institution` free text with no university entity; term fields split across scopes:
  `classes.semester`+`academic_year` (class identity) vs `class_course_schedules.period`+`start_date`/`end_date`
  (schedule validity, added 20261105);
  `checkin_` columns vs `check_in_` functions; `type` vs `assignment_type`.
- Statuses are CHECK-constrained text, not enum types — treated as a deliberate, cheaper-to-evolve choice,
  not a defect.

## 8. Domain and entity classification

Classification with per-domain evidence is in [DATABASE_DOMAIN_MAP.md](./DATABASE_DOMAIN_MAP.md). Summary:

| Domain                   | Core tables                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Identity & Profiles      | `profiles`, `platform_admins`, activity/error event tables                                         |
| Classes & Memberships    | `classes`, `class_members`, `class_admins`, invitations, applications, verification                |
| Courses & Subjects       | `courses`, `class_subjects`, `class_course_schedules`, `course_materials`, `class_calendar_events` |
| Assignments              | `assignments`, attachments, completions, reports, revisions, reviews                               |
| Attendance & Sessions    | `discussion_sessions`, check-ins, RSVPs, reminders, verification attempts, correction audits       |
| Absence Requests (leave) | `leave_requests`, evidence, history, forwardings, lecturer outcomes                                |
| Notifications & Push     | events, deliveries, preferences, `push_subscriptions`, `saved_assignments`                         |
| Calendar & Integrations  | personal events, Google Calendar connections/mappings                                              |
| Administration & Audit   | `audit_logs`, developer incidents, `feedback_entries`, `rate_limits`                               |

On the `classes` / `courses` / `class_subjects` / `class_members` / `profiles` question (INFERRED, agreeing
with Phase 3): they are **separate domain concepts**, not duplicated responsibilities —
cohort, global catalogue, cohort-subject, membership junction, and user profile respectively.
The problem is naming clarity, not entity duplication. Unclear-ownership items are listed in the domain map.

## 9. RLS and authorization metadata

Verbatim policies (public 83 + storage 18, with USING/WITH CHECK text) are in [RLS_POLICIES.md](./RLS_POLICIES.md).
Security interpretation is Phase 3 (RLS_SECURITY_AUDIT), independently re-confirmed structurally here:

- VERIFIED: 52/52 public tables have `relrowsecurity=true`; 0 use `relforcerowsecurity`. RLS is on
  everywhere, but nothing relies on FORCE — owner/`SECURITY DEFINER` paths are outside RLS by design.
- VERIFIED (structural): the authorization kernel helpers (`is_class_member`, `is_class_admin`,
  `is_platform_admin`, `can_manage_class`, `can_view_session`, `can_view_leave_request`, …) exist as
  `SECURITY DEFINER` functions (see §10); Phase 3 verified their bodies bind `auth.uid()` server-side.
- NOT claimed here: that any policy is "secure" merely because RLS is enabled. Known exceptions from Phase 3
  (re-confirmed as policy text in RLS_POLICIES.md): `class_course_schedules` writable by any class member;
  `class_subjects` world-readable when active; `can_view_leave_request` uses `search_path 'public','pg_temp'`;
  `class-media` public storage read (see §11).
- Boundary types present (INFERRED from policy text): user-level isolation, class-level isolation via
  `is_class_member(p_class_id)`, class-admin via `is_class_admin`/`can_manage_class`, platform admin via
  `is_platform_admin`, anonymous access only on intentionally public reads (`courses_public_read`,
  `profiles_public_read`, public assignments/sessions). No policy references a tenant (VERIFIED — no
  `university_id` exists, §13).

## 10. Functions, triggers and database automation

Inventories are in [DATABASE_OBJECTS.md](./DATABASE_OBJECTS.md) (158 local public functions with signature,
return type, language, SECURITY DEFINER/INVOKER, volatility, owner, `proconfig`, comment; 40 triggers with
timing/event/function; 0 public views; enums/composites; extensions; sequences).

Key verified facts:

- **Production drift (VERIFIED, Phase 4A):** `rls_auto_enable()` exists in production (ref `kdqsrckmmoucdqiapovr`)
  but is absent locally and from all 83 repo migration files (grep-verified). It is the `SECURITY DEFINER`
  function behind the enabled production event trigger `public.ensure_rls` (owner `postgres`,
  `evtenabled='O'`): any `CREATE TABLE` in `public` triggers it to `ENABLE ROW LEVEL SECURITY` on the
  new table. `proconfig={'search_path=pg_catalog'}`; owner `postgres`; `EXECUTE` granted to
  `PUBLIC`, `anon`, `authenticated` and `service_role`. The Phase 3 SECURITY_DEFINER_AUDIT also flags
  its body as NOT line-verified. This is the single known schema drift between production and the repo.
  Full analysis: [PHASE_4A_VALIDATION_REPORT.md](./PHASE_4A_VALIDATION_REPORT.md) §3.
- SECURITY DEFINER: 143/159 in production (Phase 3 inventory verdict: all declare a `search_path`;
  exactly one function uses dynamic SQL, `rls_auto_enable`). Local count is 142/158 for the same reason.
- Function bodies are not reproduced here. Full `pg_get_functiondef` review is NOT VERIFIED (Phase 3,
  INCOMPLETE by design) — see §15 candidate P1.
- **Scheduled jobs:** `pg_cron` is NOT installed locally or remotely (VERIFIED: no `cron` schema/extension).
  Retention jobs run through Next.js API cron routes (`/api/cron/attendance-retention`,
  `/api/cron/notification-retention`) invoking `purge_discussion_checkin_coordinates` /
  `purge_notification_deliveries` (§14). The Vercel cron schedule itself is UNKNOWN from DB metadata.
- EXECUTE privileges per function were NOT inspected in this pass — marked UNKNOWN (§15).

## 11. Storage architecture

Buckets (VERIFIED from `storage.buckets`; detail table in [DATABASE_OBJECTS.md](./DATABASE_OBJECTS.md)
and §11 of this document for the summary):

| Bucket                   | Public | File size limit       | Allowed MIME                     | Local objects | App usage (INFERRED from source)          |
| ------------------------ | ------ | --------------------- | -------------------------------- | ------------- | ----------------------------------------- |
| `assignment-attachments` | NO     | 10 MiB (10,485,760 B) | pdf, docx, pptx, xlsx, png, jpeg | 0 (local)     | assignment uploads, signed URLs 900 s     |
| `avatars`                | YES    | 2 MiB (2,097,152 B)   | png, jpeg                        | 0             | profile photos via `set_my_avatar_url`    |
| `class-media`            | YES    | 4 MiB (4,194,304 B)   | png, jpeg                        | 0             | class avatar/cover via `set_class_media`  |
| `leave-evidence`         | NO     | 10 MiB (10,485,760 B) | pdf, jpeg, png                   | 0             | medical/leave evidence, signed URLs 300 s |
| `verification-evidence`  | NO     | 10 MiB (10,485,760 B) | pdf, jpeg, png                   | 0             | class-verification evidence               |

- Storage policies: 18 on `storage.objects` (VERIFIED, verbatim in [RLS_POLICIES.md](./RLS_POLICIES.md)).
  Private buckets enforce `storage.foldername(name)[1] = auth.uid()` on write (Phase 3 STORAGE_SECURITY_AUDIT,
  confirmed by policy text).
- `class-media` P1 (Phase 3, re-confirmed): `public=true` with an unrestricted SELECT policy for
  `{anon, authenticated}` — any anonymous reader can read any object; currently 0 objects locally and
  production contents unconfirmed in this pass (Phase 3 recorded 11 total objects across buckets on 2026-11-04,
  including 0 in `class-media`). Owner decision required before multi-tenancy (tenant isolation prefix).
- Object contents, private URLs and personal file metadata were not inspected in this pass (UNKNOWN).

## 12. Data integrity and lifecycle

Structural facts (VERIFIED from `pg_constraint`):

- `ON DELETE CASCADE` is used broadly (decoded per-FK in [DATABASE_RELATIONSHIPS.md](./DATABASE_RELATIONSHIPS.md));
  `ON DELETE RESTRICT` protects `courses` (Phase 3). The highest-risk direction is `auth.users -> profiles /
assignments / check-ins` CASCADE, which deletes academic history on user deletion (Phase 3 SCHEMA_AUDIT P1;
  mitigation proposed there is soft-suspend, a product decision — not implemented).
- Nullable FKs and missing unique constraints: per-table detail in TABLE_CATALOG/COLUMN_DICTIONARY. No table
  lacks a PK (VERIFIED). Append-only history tables exist and should be preserved:
  `leave_request_history`, `attendance_correction_audits`, `audit_logs` (Phase 3 DATA_LIFECYCLE_AUDIT).
- Soft deletion: no global `deleted_at` pattern (VERIFIED column dump), but a partial soft-archive pattern
  exists — `assignments.archived_at` and `classes.archived_at` (+ `classes.archived_by`) are the only
  archive columns in `public`. Other tables use status columns instead.
- Retention: `checkin_latitude/longitude` are coordinate-pruned via `purge_discussion_checkin_coordinates`;
  `notification_deliveries` via `purge_notification_deliveries` (both RPCs exist; whether cron routes run
  successfully in production is UNKNOWN from DB metadata — Phase 3 flags both as unproven).
  `app_error_events.error` PII presence is UNKNOWN (Phase 3 P1: scrub + 90-day purge proposed).
- **Do not delete historical academic records** (attendance, leave, submissions, membership, sessions) as an
  optimization — this is a hard constraint for any future refactoring (§15–§16).

## 13. Multi-tenant readiness assessment

Verdict: **NOT READY** — independently confirmed and consistent with Phase 3 MULTI_TENANT_AUDIT.

- VERIFIED absence: no `university_id`, `tenant_id` or `org_id` column anywhere in `public`
  (column dump grep, empty); no `universities` or `university_memberships` table; `classes.institution`
  is free text; `platform_admins` is a global role (0 rows by estimate).
- Ownership paths: `profiles` have no tenant link; `classes` have no university FK; `courses` is global.
  A user could therefore belong to multiple universities in the future model only via a new membership table —
  currently no constraint either way (INFERRED: single-tenant assumption is implicit, not enforced).
- Tenant-aware uniqueness/FKs: none (e.g. `classes_period_code_key`-style uniqueness is global).
- RLS: 0 of 83 public policies reference a tenant (VERIFIED by policy text) — adding `university_id`
  touches every policy plus all 143 SECURITY DEFINER functions plus storage paths (§11). Effort: HIGH.
- Gap analysis (design, NOT implemented): `universities` (tenant root), `university_memberships`
  (user↔university), `university_id NOT NULL` on tenant-owned tables, tenant-scoped uniques, RLS
  `university_id = current_tenant()` **in addition to** (never instead of) the class check, server-side
  tenant resolution from verified session, storage tenant prefix. Role separation must be preserved:
  Platform Admin (global) vs University Admin (tenant) vs Class Admin (single class — must stay class-scoped)
  vs Student. **Do not assume one user belongs to only one university.**
- Gate: multi-tenancy must not start until a full logical backup is verified and the policy/function
  full-text dumps are reviewed (Phase 3 DATABASE_AUDIT_SUMMARY P0; see §15).

## 14. Application dependency mapping

Source-code evidence (read-only grep over `apps/web/src`, `packages/contracts`, `packages/shared`;
file:line evidence collected in this pass and summarized below — full mapping per feature is in the
working notes of this task):

- **Attendance:** tables `discussion_sessions`, `discussion_session_checkins`, `discussion_session_rsvps`,
  `class_subjects`, `assignments`, `class_members`, `classes`; RPCs `create/open/close/reopen_attendance_meeting`,
  `check_in_attendance_meeting`, `record_attendance_correction`, `class_attendance_meeting_list`,
  `attendance_meeting_roster/failures`, `class_attendance_recap/member_summary/session_summary`,
  `session_checkin_summary`, session RPCs (`create/update_discussion_session`, `rsvp_discussion_session`, …),
  `purge_discussion_checkin_coordinates` (cron route).
- **Assignments:** tables `assignments`, `assignment_attachments`, `assignment_completions`,
  `assignment_reports`, `assignment_revisions`, `assignment_reviews`, `courses`; RPCs `list_assignments`,
  `create_or_get_course`, `submit/publish/revise/review_class_assignment`, `moderate_assignment`,
  `report_assignment`, `review_assignment_report`, `review_public_assignment`.
- **Leave (absence):** tables `leave_requests`, `leave_request_evidence`, `leave_request_history`,
  `leave_request_forwardings`, `leave_request_forwarding_items`; RPCs `create/update/submit/cancel/review_leave_request`,
  `set_leave_request_subjects`, `complete_leave_forwarding`, evidence OCR RPCs.
- **Classes/memberships/verification:** tables `classes`, `class_members`, `class_admins`, invitations
  (3), applications (2), verification (3), `audit_logs`; RPCs `list_classes`, `update_class_metadata`,
  `set_class_join_policy/status`, `delete_class`, invitation/application/verification lifecycles.
- **Courses/subjects/calendar:** tables `courses`, `class_subjects`, `class_course_schedules`,
  `course_materials`, `class_calendar_events`, `personal_calendar_events`, `google_calendar_*`;
  subject RPCs `create/update/delete_class_subject`.
- **Notifications/push:** tables `notification_events`, `notification_deliveries`, `notification_preferences`,
  `push_subscriptions`, `saved_assignments`; RPCs `claim/complete_notification_*`, `register/delete_push_subscription`,
  session-reminder claim/complete/audience RPCs, `purge_notification_deliveries` (cron).
- **Exports:** no direct table access — generated from attendance RPC reads; `log_attendance_export` is the
  only export-specific RPC.
- **Views:** none consumed (VERIFIED: generated types show empty `Views`; no `CREATE VIEW` in migrations).
- **Buckets:** the 5 buckets in §11, via constants in `apps/web/src/lib/storage/*`.
- **Candidate unused (zero app call sites; DB-internal use INFERRED):** `leave_lecturer_outcomes`
  (RPC `record_leave_lecturer_outcome` also uncalled), `attendance_verification_attempts`
  (written inside check-in RPCs; never read back by the app — likely an intentional audit trail).
  `rate_limits` and `attendance_correction_audits` are used indirectly via RPCs only.
- `packages/contracts` and `packages/shared` contain **no** DB calls (Zod schemas + pure helpers only).

## 15. Structural refactoring candidate analysis

Categorization: P0 = security/data-integrity; P1 = structural ambiguity / high impact; P2 = naming/maintainability;
P3 = documentation/organization. Nothing here is implemented or scheduled — each candidate needs human approval,
a migration plan, and rollback thinking before any action.

### P0

| #    | Current state                                                                   | Evidence                                                       | Why it matters                                                                                   | Proposed direction                                                                                                                      | Affected objects                                 | Affected app modules | Migration complexity | Backward compat                           | Rollback                          | Further investigation                           |
| ---- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------- | -------------------- | ----------------------------------------- | --------------------------------- | ----------------------------------------------- |
| P0-1 | No tenant boundary (`university_id` nowhere)                                    | VERIFIED §13; Phase 3 MULTI_TENANT_AUDIT                       | Blocks SaaS multi-university; cross-tenant leak risk the moment a second university is onboarded | Tenant design gate: backup verified → policy/function full dump → `universities` + `university_memberships` + `university_id` migration | 52 tables, 83 policies, 143 functions, 5 buckets | all                  | HIGH                 | feature-flag off + keep single-tenant RLS | restore from pre-migration backup | backup P0.1 first (Phase 3 open item)           |
| P0-2 | `class-media` bucket public with unrestricted anon read                         | VERIFIED policy text §11; Phase 3 STORAGE_SECURITY_AUDIT P1    | Any object ever placed is world-readable                                                         | Confirm contents; if not avatar/cover-only → make private + signed URLs                                                                 | `storage.buckets`, 1 policy                      | class media upload   | LOW                  | signed-URL cutover                        | flip back to public               | object content review needs owner authorization |
| P0-3 | `auth.users -> profiles/assignments/check-ins` CASCADE deletes academic history | VERIFIED FKs (INFERRED direction, §5); Phase 3 SCHEMA_AUDIT P1 | User deletion wipes attendance/submission history                                                | Product decision: soft-suspend instead of hard delete for `class_members` (and review other CASCADEs)                                   | FKs on user-owned tables                         | auth/profile         | MEDIUM               | trigger/function change, data preserved   | re-point FK actions               | product sign-off required                       |

### P1

| #    | Current state                                                                                      | Evidence                                         | Why it matters                                                               | Proposed direction                                                                             | Affected objects           | Affected app modules                   | Migration complexity | Backward compat              | Rollback                           | Further investigation                  |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------- | -------------------- | ---------------------------- | ---------------------------------- | -------------------------------------- |
| P1-1 | `rls_auto_enable()` in production but not in repo migrations (schema drift)                        | VERIFIED §10                                     | Repo ≠ production; next `db push` could behave unexpectedly; body unreviewed | Dump its `pg_get_functiondef`, review it, add a migration reproducing it (or formally drop it) | 1 function                 | possibly none (internal)               | LOW                  | additive                     | drop function                      | read-only dump + security review first |
| P1-2 | 143 SECURITY DEFINER bodies not line-reviewed; EXECUTE grants UNKNOWN                              | §10; Phase 3 SECURITY_DEFINER_AUDIT (INCOMPLETE) | Mutators bypass RLS; one missed class check = cross-class write              | Full `pg_get_functiondef` + grant dump; per-function staging tests with foreign `p_class_id`   | 143 functions              | all mutating features                  | N/A (audit)          | N/A                          | N/A                                | staging fixtures (Phase 3 plan)        |
| P1-3 | `classes`/`courses`/`class_subjects` naming overlap; `discussion_sessions` dual role               | §7–§8 (INFERRED)                                 | Wrong-entity bugs; attendance logic coupled to scheduling                    | Docs-first rename plan; split attendance meetings from sessions only with measured need        | 4 core tables + dependents | classes, courses, attendance, sessions | HIGH if renamed      | view/alias shims possible    | rename is reversible via migration | design doc before any DDL              |
| P1-4 | `class_course_schedules` writable by any class member; `class_subjects` world-readable when active | VERIFIED policy text §9; Phase 3 RLS P1/P2       | Over-broad write/read vs admin-only neighbors                                | Tighten to manager-only write (product decision)                                               | 2 tables, 4+ policies      | schedule import, subject CRUD          | LOW                  | client error surface changes | restore policy                     | product sign-off                       |

### P2

| #    | Current state                                                                                               | Evidence                                                               | Why it matters                           | Proposed direction                                                                          | Affected objects    | Affected app modules       | Complexity | Backward compat      | Rollback        | Investigation                            |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------- | -------------------------- | ---------- | -------------------- | --------------- | ---------------------------------------- |
| P2-1 | `is_class_member()` per-policy calls cause seq-scan hot path                                                | Phase 3 measured `pg_stat` (class_members 23,903 seq scans on 30 rows) | Latency at scale                         | Request-level caching first; `STABLE` + composite index after `pg_stat_statements` evidence | 1 function, 1 table | all class-scoped pages     | LOW-MED    | invisible            | revert function | capture `pg_stat_statements` top queries |
| P2-2 | Retention jobs unproven (`purge_*` RPCs exist; cron route success UNKNOWN) + `app_error_events` PII UNKNOWN | Phase 3 DATA_LIFECYCLE_AUDIT                                           | Unbounded growth; possible PII retention | Verify cron route executions; scrub `app_error_events.error`; 90-day purge                  | 2 RPCs, 2 tables    | cron routes, observability | LOW        | additive             | N/A             | log inspection (read-only)               |
| P2-3 | `leave_lecturer_outcomes` + its RPC have zero app callers                                                   | §14 (source evidence)                                                  | Dead schema may confuse future work      | Confirm no admin/cron use; then deprecate or wire UI                                        | 1 table, 1 RPC      | leave feature              | LOW        | additive deprecation | restore         | grep admin tooling + DB recent writes    |
| P2-4 | `can_view_leave_request` `search_path` includes `pg_temp`                                                   | Phase 3 RLS P2 (policy text VERIFIED)                                  | Temp-object shadowing risk               | Standardize to `SET search_path TO ''` with per-function diff tests                         | 1 function          | leave requests             | LOW        | invisible            | revert function | staging diff tests                       |

### P3

| #    | Current state                                                              | Evidence                          | Why it matters       | Proposed direction                                      | Affected objects    | Affected app modules    | Complexity | Backward compat | Rollback              | Investigation      |
| ---- | -------------------------------------------------------------------------- | --------------------------------- | -------------------- | ------------------------------------------------------- | ------------------- | ----------------------- | ---------- | --------------- | --------------------- | ------------------ |
| P3-1 | Sparse DB comments; `type` vs `assignment_type`; `checkin_` vs `check_in_` | §7                                | Readability          | Comment-only migration + alias columns later if renamed | comments, 2 columns | assignments, attendance | LOW        | additive        | drop comments/aliases | none               |
| P3-2 | `notification_events` / `discussion_sessions` overlapping indexes          | INDEX_CATALOG (HYPOTHESIS)        | Minor write overhead | Merge only after `EXPLAIN ANALYZE` at ≥10× volume       | 2 tables            | notifications, sessions | LOW        | invisible       | re-create index       | staging benchmarks |
| P3-3 | `audit_logs` unbounded growth                                              | Phase 3 lifecycle (273 rows est.) | Long-term storage    | Monthly partitioning at >100k rows                      | 1 table             | audit consumers         | MEDIUM     | partition-local | unpartition           | growth projection  |

## 16. Final architecture summary

- **Current architecture:** single-tenant (today: effectively one active class cohort) PostgreSQL 17.11
  with 52 public tables, 112 FKs, 175 indexes, 83 RLS policies + 18 storage policies, 159 RPC functions
  (143 SECURITY DEFINER), 5 storage buckets, and no views. Authorization is class-scoped via
  `is_class_member`/`is_class_admin`/`can_manage_class` helpers; cross-schema spine is
  `auth.users -> profiles`; class content hangs off `classes -> class_subjects` (subjects) with
  `discussion_sessions` doubling as attendance meetings.
- **Major domain boundaries:** identity, classes/memberships, courses/subjects, assignments, attendance/sessions,
  leave, notifications/push, calendar/integrations, admin/audit (§8). The weakest boundary is
  sessions-vs-attendance sharing one table.
- **Most important structural issues:** (1) no tenant boundary (P0-1), (2) production-only function drift
  `rls_auto_enable` (P1-1), (3) unreviewed SECURITY DEFINER bodies (P1-2), (4) public `class-media` bucket
  (P0-2), (5) CASCADE history loss on user deletion (P0-3), (6) `is_class_member` hot path (P2-1).
- **Naming:** consistent mechanics (snake_case, plural tables, `*_at`, `<entity>_id`), one conceptual
  collision (`classes`/`courses`/`class_subjects`) plus minor inconsistencies (§7).
- **Integrity:** complete PK coverage, no self-references, no deferrable FKs; risk is concentrated in
  CASCADE direction and triple-scope `assignments`, plus history tables that must never be pruned.
- **Dependency risks:** attendance depends on the dual-role `discussion_sessions`; exports depend on
  attendance RPCs; `leave_lecturer_outcomes` is dead code; notification/push/calendar pipelines are
  built but unexercised (0-row estimates).
- **Multi-tenant gaps:** everything in §13 — tenant root, membership, scoped uniques/FKs, RLS predicates,
  SECURITY DEFINER re-checks, storage prefix, server-side tenant resolution. NOT READY.
- **Recommended refactoring sequence:** P0 backups + drift fix → P0 bucket decision → P1 security-definer
  full review → P1 policy tightenings (product decision) → P2 hot-path + retention → P3 cleanup →
  only then multi-tenant design (P0-1) → naming renames last, docs-first.
- **Decisions requiring human approval (explicit list):**
  1. Multi-tenant go/no-go and tenant model (§13).
  2. `class-media` public vs private (§11).
  3. Soft-suspend vs hard-delete for user removal (§12).
  4. Tightening `class_course_schedules` write / `class_subjects` read (§9).
  5. Fate of `leave_lecturer_outcomes` and of the unreviewed `rls_auto_enable` (§10, §14).
  6. `discussion_sessions` split (sessions vs attendance meetings) — likely "no" until scale forces it.
  7. Any rename of `classes`/`courses`/`class_subjects` (docs-first, last).
  8. Retention windows for `app_error_events`, `audit_logs`, `leave-evidence` files.
  9. Enabling push/calendar pipelines for a real class (load test first).

### Proposed canonical naming convention (future objects only — existing objects unchanged)

- Tables: snake_case **plural** nouns; junction tables `<a>_<b>` plural; history/audit tables `<entity>_history|_audits|_logs`.
- Columns: `id` (uuid PK), `<entity>_id` for FKs, `*_at` timestamptz, `*_date` date, `status` text+CHECK
  (enum type only when the value set is truly closed), `*_url` for external links, `storage_path` for object keys.
- Constraints: `<table>_<columns>_key|_check|_fkey`; indexes `<table>_<purpose>_idx`.
- Functions: `<verb>_<entity>` (`get_`, `list_`, `create_`, `update_`, `delete_`, `record_`, `review_`,
  `check_in_`, `purge_`); predicates `is_`/`can_`; parameters `p_<name>`; always `SET search_path TO ''`.
- Triggers: `<entity>_<action>` (`ensure_`, `enforce_`, `set_`, `sync_`, `prevent_`).
- Buckets: kebab-case matching the owning domain (`<domain>-<artifact>`); tenant prefix `<university_id>/…`
  once multi-tenancy lands.
- Avoid: new singular tables, `checkin_` without underscore, dual-scope FKs without a documented precedence,
  free-text institution identifiers (use `university_id`).

## 17. Evidence and quality

- **Inspection method (reproducible):** all dumps came from read-only catalog queries executed against the
  local Supabase DB container (`psql` SELECTs over `pg_class`, `pg_namespace`, `pg_attribute`, `pg_attrdef`,
  `pg_constraint`, `pg_index`, `pg_policies`, `pg_proc`, `pg_trigger`, `pg_type`, `pg_extension`,
  `pg_stat_user_tables`, `storage.buckets`/`storage.objects`) with `COPY ... TO STDOUT WITH CSV HEADER`,
  plus per-table `SELECT count(*)`; production was cross-checked with read-only MCP `execute_sql`
  (counts, `reltuples` estimates, function-name delta by initial letter, `pg_cron` absence).
  Re-running the same queries at any time reproduces every VERIFIED number in this document.
- **Coverage:** 52/52 public tables (100%), 535/535 public columns (100%, local), 432/432 public constraints,
  175/175 public indexes, 158/158 local public functions (159/159 remote incl. the drift function),
  40/40 public triggers, 83/83 public + 18/18 storage policies, 5/5 buckets. Non-public schemas
  (`auth`, `storage`, `realtime`, …) are inventoried by count/name only — their internal tables are
  Supabase-owned and out of scope.
- **Known gaps (UNKNOWN):** production exact row counts (only estimates programmatically available
  read-only); `EXPLAIN`-based index verdicts; SECURITY DEFINER body review; EXECUTE grants;
  `app_error_events.error` PII content; Vercel cron schedule; storage object contents;
  `discussion_sessions` exact production count (stale estimate).
- **What was NOT done:** no DDL, no migration, no policy/function/bucket change, no data modification,
  no app-code change. Existing uncommitted work in the repo was left untouched.

## 18. Absolute restrictions — compliance statement

This task was documentation-only. The following were NOT performed: production DDL, schema migrations,
table/column renaming, index creation/deletion, constraint or RLS-policy modification, function or trigger
modification, storage bucket configuration change, data deletion or modification, application code refactoring,
or any change to existing uncommitted work. The only files created are the Markdown documents in
`docs/database/architecture/` listed in the file map at the top. No credentials, API keys, database URLs,
private user data or secrets appear in any generated document (function bodies and object contents were
deliberately excluded).

## 19. Completion report

1. **Files created** (all under `docs/database/architecture/`):
   `DATABASE_SCHEMA_REFERENCE.md` (this file), `TABLE_CATALOG.md`, `COLUMN_DICTIONARY.md`,
   `DATABASE_RELATIONSHIPS.md`, `INDEX_CATALOG.md`, `DATABASE_NAMING_AUDIT.md`,
   `DATABASE_DOMAIN_MAP.md`, `RLS_POLICIES.md`, `DATABASE_OBJECTS.md`.
   No existing file was modified.
2. **Objects inspected:** 52 public tables, 535 public columns, 432 public constraints (incl. 112 FKs),
   175 public indexes, 158 local + 159 remote public functions, 40 triggers, 83 public + 18 storage
   policies, 52 public types, 5 extensions, 8 sequences, 5 storage buckets, 82 applied migrations
   (local = remote = repo).
3. **Objects that could not be inspected:** production exact row counts (estimates only);
   SECURITY DEFINER function bodies (Phase 3, INCOMPLETE); per-function EXECUTE grants (UNKNOWN);
   storage object contents / private URLs (deliberately excluded, UNKNOWN); Vercel cron schedule (UNKNOWN);
   `pg_stat_statements` top-query list and `EXPLAIN ANALYZE` results (not collected — requires staging).
4. **Coverage:** 100% of public-schema tables, columns, constraints, indexes, functions, triggers and
   policies in the local catalog; remote counts cross-verified (52 tables / 112 FKs / 83 policies /
   159 functions) with one documented drift (`rls_auto_enable`).
5. **Important structural findings:** no `university_id` anywhere (multi-tenancy NOT READY); production-only
   `rls_auto_enable()` drift; public `class-media` bucket with unrestricted anon read; `auth.users`
   CASCADE history-loss risk; `is_class_member` seq-scan hot path (Phase 3 measured); dual-role
   `discussion_sessions`; triple-scope `assignments`; dead `leave_lecturer_outcomes` pipeline;
   `classes`/`courses`/`class_subjects` naming collision; retention jobs unproven.
6. **Critical uncertainties:** exact production data volumes; SECURITY DEFINER body safety (143 functions);
   whether purge cron routes ever ran successfully; `app_error_events` PII; `class-media` object contents.
7. **Phase 4 readiness:** YES for planning — the schema is fully inventoried, Phase 3 audits are cross-referenced
   and independently re-confirmed where possible, and the refactoring sequence in §16 is ordered with gates.
   Phase 4 execution still requires the human decisions listed in §16 and a verified full logical backup
   (Phase 3 P0.1, still open). **STOP — no refactoring or migrations were started.**
