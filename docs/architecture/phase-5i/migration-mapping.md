# Migration Mapping — Single Source of Truth (Phase 5I + hardening continuation)

**Date:** 2026-11-05 · **Branch observed:** `staging/phase-5k-5l` · **Production: NOT TOUCHED.**
**Rule:** legacy columns/tables are demoted/deprecated via additive migrations only. No DROP, no semantic change without an explicit decision record. No auto-backfill, no auto-activation, no invented business rules.

**Stub migration:** `supabase/migrations/20261119000002_model_duplication_cleanup.sql` (additive ONLY, sequence 20261119+, IF NOT EXISTS guarded, LOCAL validated, never pushed to remote). It adds deprecation comments + reporting views + one provably-safe CHECK; it moves **no data** and switches **no** read paths.

## Source-of-truth table

| Legacy table/column | Replacement | Backfill status | Cutover date | Drop deadline | Notes |
|---|---|---|---|---|---|
| `class_members` | `class_memberships` | **NOT STARTED** (local: 11 vs 0 rows) | TBD — open decision (needs #7/ADR-002 + approved backfill) | **Deferred, gated on ADR-xxx** (no ADR number assigned yet) | `class_members` is the ONLY populated membership store; `is_class_member()` reads it. `class_memberships` requires `student_identities` + `university_memberships` linkage that does not exist for legacy rows. Do not switch until upstream rows exist. |
| `class_admins` | `class_admin_assignments` (+ `class_admin_permissions`) | **NOT STARTED** (local: 3 vs 0 rows) | TBD — same gate as above | Deferred, gated on ADR-xxx | `class_admins` is subset-of-members via composite FK; `class_admin_assignments` has per-permission codes + last-admin guard. Permission granularity only exists in the new table; rewriting admin checks is a cutover, not a migration. |
| `platform_admins` | stays | n/a | n/a | Never (platform root) | **Source of truth for platform-level actions** (activate University, manage academic periods). |
| `roles` | — | — | — | — | **No `roles` table exists** (verified: no CREATE TABLE roles in any migration). Do not cite it. |
| `profiles.declared_position` | stays (documentation of intent) | n/a | n/a | Never | Explicit comment in `20261029002600`: "never read by an authorization check." NOT a permission source. |
| `attendance_meetings/records/corrections` | normalized model | live (local: 4 meetings) | already sole writer for new domain | n/a — this IS the replacement | Legacy attendance lives in `discussion_sessions` + checkins (see session row below). |
| `class_course_schedules` (legacy) | `schedule_rules/instances/exceptions` | **NOT STARTED** (local: 0 vs 0) | TBD — layout/tz revalidation required | Deferred, gated on ADR-xxx | Legacy rows use wall-clock `time`; new rules are tz-aware. Revalidation per row is required; none done. |
| `announcements` (new) | stays | live | n/a | n/a — this IS the announcement model | Legacy announcements are `assignments.content_type='class_announcement'`. Both coexist; 5I-H routes new posts to `announcements`. |
| `assignments.content_type='class_announcement'` | `announcements` | **NOT STARTED** (local: 0 rows either way) | TBD — product decision (5I-10 fan-out) | Deferred, gated on ADR-xxx | Changing announcement rendering/RLS would alter visibility. Dual-write is NOT introduced. |
| `classes.academic_year` (text) | `classes.academic_year_id` | **0/12 rows carry FK** (local verified) | TBD — backfill via approved mapping | Deferred | Legacy text is `NNNN/NNNN`; `academic_years.code` is free-form. No CHECK added (mapping unverified for real data). |
| `classes.semester` (text) | `classes.semester_id` | **0/12** | TBD | Deferred | Same as above. |
| `classes.institution` (text) | `classes.university_id` | **0/12** | TBD — blocked on #7 fuzzy mapping | Deferred | Free-text institution cannot auto-map to registry. |
| `classes.class_code` | `classes.code` | **6/12 vs 0/12** — MISMATCH (identity proven) | TBD — consolidation decision | Deferred | Both columns exist; `class_code` has a normalized generated column + period-unique index (`classes_period_code_key`), `code` has only a length CHECK. Read path today = `class_code`. Consolidation is a decision, not a cleanup. |
| `classes.course_name` | `courses.name` via `course_id` | denormalized copy at creation | TBD | Deferred | Snapshot at creation time; do not treat as live link. |
| `discussion_sessions` | view `discussion_sessions_domain_view` (20261119000002) | n/a (labels, not moves) | TBD — no data moves until cutover date approved | Deferred, gated on ADR-xxx | Table is real domain: scheduled attendance/meeting row (see §5 below). Comment documents it; zero FK changes. |

### Admin role source-of-truth per action domain

| Action domain | Source of truth | Why |
|---|---|---|
| Platform (university activation, academic years, registry) | `platform_admins` | No client policies; manual audited grants. |
| Class membership / RLS (`is_class_member()`) | `class_members` (live) | 39 occurrences; `class_memberships` unreachable until identities exist. |
| Class admin checks (legacy `is_class_admin()`, `can_manage_class()`) | `class_admins` (live) | Composite FK subset guarantee; permission tables empty. |
| New-domain admin checks (`has_class_permission()`) | `class_admin_assignments` + `class_admin_permissions` | Only source of per-permission codes. |
| Self-declared position | `profiles.declared_position` | Documentation only; never authorization. |

> Any "switch" of a legacy source to a new one is a product cutover requiring an ADR + backfill + read-path change. This migration does **not** switch anything.

## 1. Deprecation status comments (what was actually added)

`20261119000002_model_duplication_cleanup.sql` (local validated, not pushed):

- `COMMENT ON TABLE public.class_members` / `public.class_admins` — appended with "DEPRECATED (expand-contract step 1, 2026-11-05)" pointer; existing comment text preserved, no RLS/grant change.
- `COMMENT ON COLUMN public.classes.academic_year/semester/institution/class_code/code/course_name` — marks legacy text columns deprecated in favor of FK-backed counterparts and records the read-path decision: **prefer FK-backed fields when present** (application-level `COALESCE`; no DB default invented).
- `COMMENT ON TABLE public.discussion_sessions` — documents the god-table reality (see §5) without renaming the table or touching FKs.
- `COMMENT ON COLUMN public.assignments.{course_id,class_id,subject_id,offering_id,content_type}` — documents why all four coexist (see §4).

## 2. Dual-column classes — CHECK constraints audit

Local verification (disposable stack, 2026-11-05):

```
classes total=12  academic_year_id set=0  semester_id set=0  university_id set=0
code set=0  class_code set=6  status=active(12)
```

- **No FK↔text consistency CHECK added.** With 0 FK-populated rows, any CHECK would be vacuous locally and unprovable for production. Documented and deferred. No NOT NULL on any FK column (upstream backfill first).
- **Read-path decision (documented, not implemented in SQL):** readers prefer `academic_year_id`/`semester_id`/`university_id` when NOT NULL, else fall back to legacy text. A view is provided (`classes_legacy_vs_fk_gap`) for observability of the gap; the app read path is **not** changed in this pass because changing it would be a silent cutover.
- `classes.course_name` is a creation-time snapshot of `courses.name`; no CHECK enforces equality (correctly — snapshots are allowed to diverge).

## 3. NIM in 3 places — sync-risk note (unresolved #7)

| Store | Uniqueness scope | Local count |
|---|---|---|
| `profiles.nim` | **Global** (`profiles_nim_unique`, case-insensitive, trimmed) | 0 rows set |
| `university_memberships.student_id` | **Per-university** (`(university_id, lower(btrim(student_id)))`) | 0 rows set |
| `student_identities.student_id` | Per-university (composite FK domain) | 0 rows set |

**Risk (documented, unresolved #7):** a NIM valid globally under v1 may be invalid under a per-university model and vice versa. The global index forbids any two rows sharing a NIM even across different universities, which is stricter than the per-university model allows. No change to `profiles_nim_unique` is made in this pass. Reconciliation is a dry-run-only script:

- **New:** `scripts/reconcile-nim-dry-run.mjs` — read-only: lists (a) `profiles.nim` set but no `student_identities` row, (b) per-university-identity NIM with no global match, (c) cross-university collisions the global index would reject after a switch. Prints counts + sample ids, **never writes**. Run only against a disposable DB with explicit `SUPABASE_URL` override; defaults to local `127.0.0.1:54322`.

## 4. Assignments ambiguity — why all four keys exist, and what a single owner needs

`assignments` carries `course_id NOT NULL` (catalog course, `20261029000100`), `class_id NULL` (class group, class content scoping), `subject_id NULL` (a `class_subjects` row — one course-in-context inside a class), `offering_id NULL` (new `course_offerings` row, 20261115 ops). They are **four different grains**, not four copies of one key:

- `course_id` = which catalogue course (global, shared across classes/universities).
- `class_id` = which class group owns the row (RLS scope; class-less published rows remain public-repo entries).
- `subject_id` = which course-in-context inside that class (deletion-guard + archived-course block).
- `offering_id` = which dated, tenant-scoped offering of that course under a university.

A **single owner** would require deciding **catalogue scope (#2)** first: are courses global or per-university? Until that is decided, collapsing any pair would invent a rule. **No CHECK added** beyond what prod-verified triggers already enforce; with 0 local rows, any new CHECK would be vacuous.

**Reporting view shipped:** `public.assignments_owner_reporting` computes the effective owner grain per row:

```sql
CASE WHEN offering_id IS NOT NULL THEN 'offering'
     WHEN subject_id IS NOT NULL THEN 'subject'
     WHEN class_id IS NOT NULL THEN 'class'
     ELSE 'public_repo' END
```

Useful for migration planning/counting; changes no rows and no RLS.

## 5. discussion_sessions god table

Real domain (evidence: `20261029001600_discussion_sessions.sql` + session/checkin functions): a `discussion_sessions` row is a **scheduled attendance/meeting** — it drives checkins, RSVPs, reminders, and calendar links, and post-migration it is read by the attendance flows. Renaming to `meetings` now would break every FK/policy/function and every client contract for zero user benefit.

**What shipped:** comment-only rename-of-record + a view:

- `COMMENT ON TABLE public.discussion_sessions` now states: "Real domain: scheduled class attendance/meeting row (starts_at/ends_at/checkins/RSVPs). Not a chat thread. Do not rename until cutover date is approved."
- `CREATE OR REPLACE VIEW public.discussion_sessions_domain_view` exposing: schema, `is_attendance_session` classification, window length, and status↔timestamp consistency columns for reporting. Read-only; no FKs touched. **No data moves.**

## 6. Dual state sources — row count contradictions

Read-only local verification (2026-11-05, disposable stack):

| Pair | Local rows | Contradiction |
|---|---|---|
| `assignments.status='archived'` vs `archived_at` | 0 rows total | No contradiction observable; trigger `sync_assignment_archived_at` already enforces the pair. |
| `classes.status='archived'` vs `archived_at` | 12 rows, all `active` | No contradiction observable; trigger `sync_class_archived_at` exists. |
| `discussion_sessions.status` vs `cancelled_at`/`completed_at` | 0 rows | CHECK `discussion_sessions_status_consistency` already shipped (20261029). |
| `audit_logs` stale `pending_review` vs RLS expectations | 0 assignment rows | N/A locally — no duplicate display-state provable. |

**Deduping `pending`/`pending_review` was NOT done:** assignments uses `published`/`pending`/`archived` (I checked the actual CHECK: `assignments_status_allowed = ('published','pending')` at MVP, later archiving) while class-submission flow inserts `pending_review` via RPC — the two live in different call paths. Collapsing them would be inventing a policy. **Deferred, documented, not implemented.**

**One provably-safe CHECK:** `assignments_status_archived_consistency` (`(status='archived') = (archived_at IS NOT NULL)`) is added **redundantly** because the trigger provably maintains the invariant and the view surfaces drift. Guarded by `IF NOT EXISTS`; safe on empty and populated tables.

## 7. Naming inconsistency — separate doc

See `docs/architecture/phase-5i/naming-conventions.md`. No existing column is renamed.

## 8. Legacy university_id nullable — weakest-table principle

Tenant isolation is **as strong as the weakest table**. `audit_logs.university_id` is nullable with **76/76 NULL rows locally**; `classes.university_id` is **12/12 NULL locally** (0 assignments — all classes pre-date tenancy linkage). Until upstream rows (`classes`, `audit_logs`) carry a tenant key, no child table can be safely made NOT NULL, and no tenant query can assume it. **Expand-contract path, no blind NOT NULL:**

1. Platform links each `classes` row to a `universities` row (approved mapping — #7 gate).
2. Backfill tenant keys bottom-up (children first, then parents), verifying null-counts = 0 in the target environment.
3. Only then propose NOT NULL per table, table by table, with a written decision record.

This pass proposes no NOT NULL. `20261119000001_audit_university_enforcement.sql` remains the commented-out STOP panel for `audit_logs`.

## Scope-compliance note

This pass added exactly these files (nothing else touched; all unrelated dirty WIP files/dirs from `git status` were preserved untouched):

- `docs/architecture/phase-5i/migration-mapping.md` (this file)
- `docs/architecture/phase-5i/naming-conventions.md`
- `docs/architecture/phase-5i/model-duplication-cleanup-implementation.md`
- `supabase/migrations/20261119000002_model_duplication_cleanup.sql`
- `supabase/tests/model-duplication-cleanup-validation.sql`
- `scripts/reconcile-nim-dry-run.mjs`

`20261110000000_subject_enrollment.sql` SHA-256 verified unchanged start/end (see implementation doc). No production access, no cron, no reset, no destructive SQL.
