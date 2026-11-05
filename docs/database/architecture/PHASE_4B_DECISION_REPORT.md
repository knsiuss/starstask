# Phase 4B Decision Report — StarsTask Architecture

> **Purpose:** evidence-based decision package for future database structural refactoring and
> multi-tenant architecture. Read-only; no schema changes made.
> **Date:** 2026-11-04 (Phase 4B).
> **Companions:** [PHASE_4A_VALIDATION_REPORT.md](./PHASE_4A_VALIDATION_REPORT.md) (reconciliation),
> [ARCHITECTURE_DECISION_REGISTER.md](./ARCHITECTURE_DECISION_REGISTER.md) (register),
> [PHASE_4B_SECURITY_DEFINER_REVIEW.md](../audit/PHASE_4B_SECURITY_DEFINER_REVIEW.md),
> [PHASE_4B_RECOVERY_GATE.md](../backup/PHASE_4B_RECOVERY_GATE.md).
> **Evidence legend:** VERIFIED = catalog-observed; INFERRED = interpretation; UNKNOWN/BLOCKED as marked.
> Recommendations are kept separate from verified facts.

---

## 1. Foreign key action legend — corrected (task §1)

**Verified bug:** [DATABASE_RELATIONSHIPS.md](./DATABASE_RELATIONSHIPS.md) legend read
`a=CASCADE, r=RESTRICT, n=SET NULL, d=SET DEFAULT, no action=n/a`.
**Correct PostgreSQL mapping:** `a` = NO ACTION, `r` = RESTRICT, `c` = CASCADE,
`n` = SET NULL, `d` = SET DEFAULT.

Consequence: every `a` in the 112-row table means **NO ACTION** — notably all `ON UPDATE`
columns (112× NO ACTION) and any ON DELETE `a`. Verified distribution (both environments
agree on counts; local `pg_constraint` histogram):

| Action          | ON DELETE | ON UPDATE |
| --------------- | --------- | --------- |
| `c` CASCADE     | 65        | 0         |
| `n` SET NULL    | 43        | 0         |
| `r` RESTRICT    | 4         | 0         |
| `a` NO ACTION   | 0         | 112       |
| `d` SET DEFAULT | 0         | 0         |

Legend corrected in RELATIONSHIPS.md and summarized in SCHEMA_REFERENCE §5. No FK constraint
itself was changed. The 4 RESTRICT FKs are the `courses` catalogue protections
(`classes_course_id_fkey`, `assignments_course_id_fkey`, + 2 others — see RELATIONSHIPS table).

---

## 2. `rls_auto_enable()` production-only mechanism (task §2)

### 2.1 Verified facts (both environments + repo grep)

| Property              | Value                                                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Function              | `public.rls_auto_enable() RETURNS event_trigger`, `plpgsql`, SECURITY DEFINER, `proconfig={search_path=pg_catalog}`, owner `postgres`                                                                                                                                                               |
| EXECUTE grants        | `{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — PUBLIC included (broader than needed)                                                                                                                                                    |
| Body                  | Loops `pg_event_trigger_ddl_commands()` for `CREATE TABLE` / `CREATE TABLE AS` / `SELECT INTO` in schema `public`; runs `alter table if exists public.<tbl> enable row level security` with `%I.%I` quoting; logs enabled/failed/skipped. No user input reaches the DDL string — no injection path. |
| Event trigger         | `public.ensure_rls` (owner `postgres`, `evtenabled='O'`) invokes it on DDL events                                                                                                                                                                                                                   |
| Direct invocation     | Possible (EXECUTE granted) but **meaningless** outside a DDL event (loop returns empty). It is an event-trigger handler, not an application API.                                                                                                                                                    |
| Local                 | Absent (0 rows). Local event-trigger list not dumped (NOT VERIFIED locally — see §2.3).                                                                                                                                                                                                             |
| Migrations            | grep `rls_auto_enable` / `ensure_rls` / `CREATE EVENT TRIGGER` across all 83 files: **no matches**                                                                                                                                                                                                  |
| App code / procedures | No references. Deployment procedure unknown (UNKNOWN).                                                                                                                                                                                                                                              |
| Dependencies          | `pg_event_trigger_ddl_commands()` (built-in); no app tables.                                                                                                                                                                                                                                        |

### 2.2 Option A — Reproduce in version-controlled migrations

- **What:** add a new migration recreating `rls_auto_enable()` + `CREATE EVENT TRIGGER
public.ensure_rls ... WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')` verbatim,
  applying to local/staging.
- **Security:** preserves current production behavior (auto-enable RLS on new tables — a genuine
  defense-in-depth). No privilege change. Body is defensively written.
- **Deployment:** local/staging parity; future table migrations inherit RLS automatically.
  Must also decide the EXECUTE grant (recommend authenticated/service_role only, drop PUBLIC `=X` —
  event triggers fire regardless of grants).
- **Local/staging consistency:** yes — this is the only option that makes local reproduce production.
- **Rollback:** `DROP EVENT TRIGGER IF EXISTS ensure_rls; DROP FUNCTION IF EXISTS rls_auto_enable();`
  in a follow-up migration. No data impact.
- **Required testing:** (1) apply in staging; (2) create a scratch table in `public` and verify
  `relrowsecurity=true` without manual ALTER; (3) verify existing 52 tables unaffected (they are
  already RLS-enabled); (4) verify negative case: table in another schema untouched.

### 2.3 Option B — Remove via separately approved migration

- **What:** `DROP EVENT TRIGGER IF EXISTS public.ensure_rls;` + `DROP FUNCTION IF EXISTS
public.rls_auto_enable();` in production, via owner-approved migration.
- **Security:** removes an unaudited-by-review, PUBLIC-executable definer function. Production
  relies on explicit `ENABLE ROW LEVEL SECURITY` in migrations instead — which is the current
  repo convention (all 52 tables enabled explicitly, RLS_POLICY checks in staging).
- **Deployment:** production then matches repo exactly (158 functions). New tables must carry
  explicit RLS — a migration-review checklist item, not automatic.
- **Local/staging consistency:** yes, trivially (delete nothing locally; production converges to local).
- **Rollback:** re-create from the recorded `pg_get_functiondef` (captured Phase 4A) in a
  follow-up migration. Data unaffected (RLS already enabled on all 52 tables; only future
  tables lose the auto-enable safety net).
- **Required testing:** (1) create scratch table in staging without RLS; verify it stays
  RLS-disabled (confirms removal works); (2) verify all existing policies/functions unaffected;
  (3) add migration-review checklist requiring `ENABLE ROW LEVEL SECURITY` + policies for every
  `CREATE TABLE`.

### 2.4 Recommendation (Pending owner approval)

**Option A if the team wants automatic RLS safety for future tables; Option B if the team prefers
explicitness to match the repo's migration style.** Either is safe; the decision is about
convention, not security weakness. Preconditions for either: verified backup (Recovery Gate G-1/G-4)

- staging rehearsal + owner sign-off. **Do not execute either in this phase.**

UNKNOWN item: whether `ensure_rls` exists on local (event-trigger list not dumped). Close it in
staging rehearsal for whichever option is chosen.

---

## 3. Unapplied migration `20261110000000_subject_enrollment.sql` (task §3)

### 3.1 Exact scope (422 lines, VERIFIED by reading the file)

- **New table:** `public.class_subject_members` (composite PK `(class_id, subject_id, user_id)`,
  FKs to `classes` CASCADE, `class_subjects` CASCADE, `auth.users` CASCADE, composite FK
  `(class_id, user_id) → class_members(class_id, user_id)` CASCADE, CHECK `enrolled_via IN
('backfill','invitation','admin_assignment','platform_assignment','manual')`,
  indexes `class_subject_members_user_idx`, `class_subject_members_subject_idx`).
- **RLS:** ENABLE RLS + 4 policies (select: own-or-manage; insert/update/delete: manage-only),
  `REVOKE ALL` then GRANT to `authenticated` (defense-in-depth correct).
- **New function:** `public.is_subject_member(uuid, uuid)` STABLE SECURITY DEFINER
  `search_path=''` — correct pattern (matches the 11 kernel functions).
- **2 trigger functions + 2 triggers:** `enroll_members_on_class_join` on
  `class_members AFTER INSERT`; `enroll_members_on_subject_create` on
  `class_subjects AFTER INSERT`. Both SECURITY DEFINER `search_path=public, pg_temp`.
- **Backfill INSERT:** every current `class_members` row × every active `class_subjects` of
  the class → `enrolled_via='backfill'`, `ON CONFLICT DO NOTHING`. Behavior-preserving on day one.
- **2 existing function rewrites:** `attendance_meeting_roster` (filter members to enrolled
  when `subject_id` present) and `class_attendance_recap` (INNER JOIN enrollment).
- **2 function-body patches via `pg_get_functiondef` string replacement:**
  `check_in_attendance_meeting` (6-arg) — add enrollment check returning
  `checkin_unavailable`; `class_attendance_meeting_list` — count enrolled members only.
  Each patch verifies the replacement text and raises if it did not apply.
- **Comments** on table + function.

### 3.2 Metadata impact

52 → 53 public tables; 158 → 161 public functions (local scale: 142 → 145 SECURITY DEFINER);
40 → 42 triggers; 83 → 87 public policies; 112 → 116 FKs. No storage/bucket/extension changes.

### 3.3 Application dependencies (VERIFIED by grep this pass)

- `apps/`: **no references** to `class_subject_members` / `is_subject_member` (grep clean).
- `packages/contracts` / `packages/shared`: no references (same grep family).
- Intended consumers are RPC-side (check-in, roster, recap, meeting list) — no frontend code
  needs to change, but attendance behavior changes once enrollment rows are removed for a subject.

### 3.4 Can it break existing data?

- **Backfill itself is safe:** PK conflict is `DO NOTHING`; existing rows untouched.
- **Function patches are the risk:** string-replacement patches against live production bodies
  are brittle — if production bodies differ by whitespace (different migration vintage), the
  patch raises and the migration fails midway. The migration does fail-safe (raises before
  half-applying? The DO blocks raise after the first patch — partial application possible:
  table/triggers/functions created, second patch raises. **Not atomic-safe without a
  transaction retry + cleanup plan.** Supabase migrations run in a transaction by default,
  which would roll back, but this must be confirmed per deploy path.
- **Behavior change:** after apply + any manager removes an enrollment row, the student
  silently drops out of roster/recap/eligibility counts for that subject. That is the intended
  feature (per-subject attendance for repeat students), but it changes historical recap counts
  if applied before historic meetings are finalized.

### 3.5 Is the functionality implemented elsewhere?

**No.** No table, no function, no app code implements per-subject attendance eligibility
today (class-level membership only — VERIFIED). This file _is_ the Option 1 design
(`docs/engineering/startask-subject-enrollment.md` referenced in its header — engineering
blueprint, intentionally outside this repo's doc set).

### 3.6 Recommendation: **REVISE** (do not APPLY as-is; do not SHELVE)

Reasons: (1) the two `pg_get_functiondef` string patches are fragile against production body
drift — rewrite them as full `CREATE OR REPLACE FUNCTION` with the enrollment checks included
(file already does this for roster/recap — extend to the other two); (2) confirm Supabase
migration transactions wrap the whole file (verify in staging); (3) add the
`class_attendance_member_summary` / `class_attendance_session_summary` counts to the same
enrollment filter or document why they intentionally stay class-wide (the file patches
meeting-list counts but inventory shows two more summary functions that count eligible members —
leaving them unpatched would make summary sheets diverge from recap). After revision:
APPLY in staging → foreign-id/freshness tests → production with backup. Status: **Pending owner
approval — NOT applied, NOT modified in this phase.**

### 3.7 Repo vs database comparison (VERIFIED)

Repo: 83 migration files. Local `schema_migrations`: 82 applied (latest
`20261109000000_checkin_message_no_numbers`). Production: 82 applied. The file
`20261110000000_subject_enrollment.sql` is in the repo but in **neither** database — the only
file-level drift.

---

## 4. Architecture decisions AD-01…AD-08 (task §6)

Compact verdicts; full register fields stay in ARCHITECTURE_DECISION_REGISTER.md.
All recommendations are **Pending** — none approved.

### AD-01 classes/cohort terminology

**Recommended: keep `classes`, document it as the cohort.** Renaming to `class_cohorts`
touches 20 FKs, 12+ policies, ~40 functions, and every app page for a terminology gain.
If ever renamed: view shim (`CREATE VIEW classes AS SELECT * FROM class_cohorts`) **is**
necessary for PostgREST/RPC compatibility, and existing `classes_slug_key` +
`classes_period_code_key` names would also change (constraint rename, not just table).
Approval required before any rename design.

### AD-02 courses catalogue ownership

**Recommended now: global catalogue (`courses` as-is); revisit at tenant design (AD-07).**
Alternatives: (a) global catalogue — current, simplest, matches `courses_public_read USING (true)`;
(b) university-owned catalogue (`university_id` on `courses`, scoped uniques) — cleanest for
SaaS but forces every assignment/class FK tenant check; (c) shared canonical + university
offerings (canonical `courses` + `university_courses` mapping) — most flexible, most tables.
Recommendation: **(a) now, (c) as the long-term target if multi-university names diverge**;
(b) is only worth it if universities must never see each other's catalogue.

### AD-03 class_subjects

**Recommended: it IS the class-specific course offering** (catalogue link `course_id` nullable
for ad-hoc subjects; class-local name/code/lecturer). Keep the entity; decide `course_id`
NOT NULL only after cataloguing how many ad-hoc subjects exist (production data query —
BLOCKED, read-only count). No rename.

### AD-04 discussion_sessions — the sensitive one

**Recommended: keep one table; enforce role separation in RPCs.** Splitting attendance
meetings into `attendance_meetings` is technically clean but requires dual-write cutover,
repointing 6 child tables (check-ins, RSVPs, reminders, audits, attempts, calendar mappings),
14 attendance RPCs, and the sheet/export — HIGH complexity + HIGH compatibility risk.
Naming similarity is **not** a reason to split (per phase instruction). A split is justified
only by measured scale (e.g. session volume ≫ meeting volume) or a hard lifecycle divergence.
RPC-level separation first: attendance RPCs reject non-meeting rows; session RPCs reject
meeting rows. That closes the boundary without DDL.

### AD-05 assignments scope

Current behavior (VERIFIED from `\d+` + `list_assignments` doc): `course_id` NOT NULL RESTRICT
(catalogue, always); `class_id` nullable SET NULL; `subject_id` nullable SET NULL; public
discovery iff `class_id IS NULL AND status='published'`; class/member read iff `class_id IS NOT
NULL`. **Data validation gaps (do not add CHECKs before inspecting history — per instruction):**
`subject_id` without `class_id`, and `course_id` not matching the class's catalogue course,
are both currently permitted by schema. Historical-row audit (BLOCKED read-only count) is a
precondition for any CHECK — record counts, then decide. **Do not add CHECK constraints yet.**

### AD-06 academic term

Separate the three concepts explicitly (VERIFIED):
`classes.semester` (NOT NULL, length 1–20 free text) + `academic_year` (`YYYY/YYYY`) = **class
term**; `class_course_schedules.period` (nullable) + `start_date/end_date` = **schedule
validity**; `assignments.semester/academic_year` (nullable) = denormalized display.
Institutions differ (ganjil/genap vs odd/even vs quarters) — do **not** assume one calendar.
Recommendation: validate `semester` format per institution later; keep the three scopes separate;
a future `academic_terms` entity is optional, not required now.

### AD-07 university tenancy

Tenant root `universities` + `university_memberships` (user↔university, multi-university
allowed — **never** assume one user → one university). Optional `campuses` under a university
only if a real second-campus requirement appears (no campus concept in schema today — do not
invent one). Hierarchy: University → Faculties/Departments (`courses.department` free text
today — FK later only if needed) → Classes → Subjects. Preserve class-level authorization
inside each university at all times.

### AD-08 tenant isolation

Tenant-aware FKs + uniques + RLS + SECURITY DEFINER + Storage, with class checks preserved:
`courses`/`classes`/`class_subjects`/`discussion_sessions` gain `university_id`;
uniques re-scoped `(university_id, …)`; RLS `university_id = current_tenant()` **in addition to**
class check; SECURITY DEFINER functions re-check tenant server-side; storage prefix
`<university_id>/…`. Migration is HIGH/HIGH — gate on backup (Recovery Gate) + staging rehearsal.
**A user may belong to multiple universities — tenant resolution must be from the verified
session per request, never a stored "active tenant" column on `profiles` without a server-side
re-check.**

---

## 5. Product and role boundary validation (task §7)

### 5.1 Verified current roles (from catalog + authorization code)

| Role (current)                                      | Evidence (VERIFIED)                                                                                                                                                                                                  | Scope                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `platform_admins` (global platform admin)           | table `platform_admins(user_id PK)`, function `is_platform_admin()`, RPCs `get_platform_admin_overview`, `list_platform_classes`, `list_platform_users`, `moderate_assignment`                                       | Platform (all classes)          |
| Class admin / manager                               | table `class_admins(class_id, user_id)`, functions `is_class_admin()`, `can_manage_class()`, `can_organize_class_sessions()`                                                                                         | One class                       |
| Class member                                        | table `class_members(class_id, user_id)`, function `is_class_member()`                                                                                                                                               | Membership in one class         |
| Owner / author                                      | `assignments.user_id`, `leave_requests.student_id` (+ `is_leave_request_owner()`, `is_class_verification_owner()`)                                                                                                   | Own rows                        |
| Public / anonymous                                  | policies `courses_public_read`, `profiles_public_read`, public assignment/session reads; `anon` grants on helper functions                                                                                           | Intentionally public reads only |
| Lecturer                                            | **Does NOT exist as a role** — `leave_lecturer_outcomes` records a lecturer _decision_ confirmed outside StarsTask (`record_leave_lecturer_outcome`); no lecturer account/role table or function                     | —                               |
| University admin / faculty admin / department admin | **Do NOT exist** — no tables, no functions, no policies reference them (grep `role/lecturer/university/faculty/department` over tables+functions: only `platform_admins`, `class_admins`, `leave_lecturer_outcomes`) | —                               |

### 5.2 Role and scope matrix — current (VERIFIED) vs proposed future (PENDING, not created)

| Level                | Current (VERIFIED)                                                      | Proposed future (NOT implemented — do not build)                                                                             |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Platform             | `platform_admins` + `is_platform_admin()`                               | unchanged; Platform Admin stays global                                                                                       |
| University           | —                                                                       | University Admin (tenant-scoped platform admin) — requires `university_memberships` + `is_university_admin(p_university_id)` |
| Faculty / department | —                                                                       | scoped admin over a department's classes — requires `department_id` on `classes`/`courses`; **not justified now**            |
| Class                | `class_admins` + `can_manage_class()` + `can_organize_class_sessions()` | unchanged; stays class-scoped                                                                                                |
| Member               | `class_members` + `is_class_member()`                                   | unchanged                                                                                                                    |

**Boundary rule (future):** University Admin ⊆ tenant, never cross-tenant; Class Admin ⊆ one
class, never university-wide. One user may hold multiple roles at different scopes — each RPC
checks the single scope it needs.

---

## 6. Performance evidence (task §8)

### 6.1 `is_class_member()` findings (Phase 3 → this pass)

Phase 3 measured `class_members` at 23,903 seq scans on 30 rows — the hottest function path.
This pass (read-only):

- `is_class_member(p_class_id)` = `STABLE`, `search_path=''`, body is an `EXISTS` over
  `class_members(class_id, user_id)` via `class_members_pkey` (composite PK, VERIFIED).
  Structurally an index-only lookup — **no EXPLAIN ANALYZE on production was run**
  (per instruction).
- `pg_stat_statements` **exists** (v1.11, extension VERIFIED in Phase 4A) — BUT top-N on the
  local stack is dominated by our own audit COPY dumps (single calls, 111 ms). Production
  `pg_stat_statements` top queries were NOT read this pass (would need a production read-only
  session + traffic window) — **UNKNOWN for production hot paths**.
- `pg_stat_user_indexes` / `pg_stat_user_tables` not read this pass (would show idx-scan vs
  seq-scan counts). Do not assume Phase 3's numbers persist.

**Limitation documented:** local statistics describe the audit session, not production.
EXPLAIN ANALYZE on production was not run (risk of locking/slowness on live tables).

### 6.2 Staging benchmark plan (synthetic data, owner-operated)

```sql
-- 1. Seed synthetic load in an isolated staging DB (not production):
--    1 university, 5 classes, 500 members/class, 200 subjects, 2,000 sessions,
--    50,000 check-ins.
-- 2. Warm + measure:
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM
  pg_stat_statements
ORDER BY
  total_exec_time DESC
LIMIT
  20;

-- after 1k representative RPC calls
-- 3. Candidate fix candidates to test (staging only):
--    a. Request-level caching of is_class_member (application side).
--    b. MATERIALIZED-friendly: is_class_member STABLE + (class_id, user_id) composite index
--       (already PK — confirm index-only scan via EXPLAIN in staging only).
--    c. Policy rewrite only if (a)+(b) insufficient.
-- 4. Gate: EXPLAIN ANALYZE in staging only; record plans before any index DDL.
-- 5. Rollback: indexes are additive (DROP INDEX IF EXISTS); function revert is a migration.
```

No benchmark was run in Phase 4B (no staging DB was available in this session).

---

## 7. Required documentation status (task §9)

| Deliverable                                                    | Status                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `docs/database/audit/PHASE_4B_SECURITY_DEFINER_REVIEW.md`      | Created (§3 family review §7 staging protocol)                                    |
| `docs/database/backup/PHASE_4B_RECOVERY_GATE.md`               | Created (G-1…G-9; gate INCOMPLETE)                                                |
| `docs/database/architecture/PHASE_4B_DECISION_REPORT.md`       | This file                                                                         |
| `docs/database/architecture/ARCHITECTURE_DECISION_REGISTER.md` | Updated — AD-01…AD-08 verdicts reference this report (Approval: still Pending)    |
| `docs/database/architecture/DATABASE_RELATIONSHIPS.md`         | Updated — legend §1 corrected (a=NO ACTION), distribution note                    |
| `docs/database/architecture/DATABASE_SCHEMA_REFERENCE.md`      | Updated — cross-schema FK evidence + legend summary; all other § counts unchanged |

---

## 8. Final report (task §11)

1. **Work completed:** (1) FK legend corrected with verified 65/43/4 + 112 distribution;
   (2) `rls_auto_enable()` fully profiled with Option A/B analysis; (3) unapplied migration
   dissected line-by-line with REVISE recommendation; (4) all 142 local SECURITY DEFINER
   functions metadata+pattern reviewed in 8 families; (5) recovery gate itemized G-1…G-9;
   (6) AD-01…AD-08 reviewed with recommended directions; (7) role matrix verified
   (lecturer/university-admin do NOT exist); (8) performance evidence + staging benchmark plan;
   (9) 6 documentation files created/updated. **Zero DDL/data changes.**
2. **Findings verified:** FK distribution; `rls_auto_enable` = single production-only object;
   142/142 definer `search_path` set; 0 dynamic SQL locally; 0 FORCE RLS; roles inventory;
   migration gap = exactly `20261110000000_subject_enrollment.sql`.
3. **Outstanding security issues (hardening, not active breaches):** PUBLIC grant on
   `complete_leave_forwarding`; authenticated grant on `claim_*/purge_*` (recommend service_role
   only); `pg_temp` shadowing surface (schema-qualification sweep BLOCKED for staging);
   `class-media` public bucket (Phase 3); CASCADE history loss on user deletion (P0-3).
   No critical authorization bypass found.
4. **Backup/recovery:** gate **INCOMPLETE** — G-1 full dump, G-4 isolated restore, G-5 auth and
   G-6 storage BLOCKED on owner; G-2/G-3 N/A; G-7 partial; G-8 PITR unknown.
5. **Migration discrepancies:** repo 83 files vs 82 applied (both envs); unapplied file =
   subject-enrollment (table+function+trigger+2 patches; app code does not reference it).
6. **Recommended AD decisions:** AD-01 keep+document; AD-02 global now (revisit c at tenant);
   AD-03 keep as class offering; AD-04 keep table + RPC role separation (no split now);
   AD-05 audit history first, no CHECKs yet; AD-06 keep three scoped term concepts;
   AD-07 universities+memberships (multi-university allowed); AD-08 tenant-in-addition-to-class
   (never instead-of). All Pending.
7. **Go/No-Go:** **GO for structural-refactoring design (Phase 4C planning)**; **NO-GO for any
   production DDL** until backup G-1+G-4 closed, U-1 decided, `20261110000000` revised+approved,
   staging tests pass, and AD-07/AD-08 design is approved.
8. **Exact owner decisions required:**
   - D-1: `rls_auto_enable` — Option A reproduce vs Option B remove.
   - D-2: `20261110000000` — REVISE (full function replaces) then APPLY, or SHELVE.
   - D-3: AD-01…AD-08 recommendations (accept / modify / reject each).
   - D-4: role model — confirm lecturer/university-admin stay non-roles for now.
   - D-5: grant hardening (PUBLIC→authenticated; claim/purge→service_role only).
   - D-6: backup execution (full dump + isolated restore + hash) with date.
   - D-7: Phase 4C scope (tenant design doc first, renames/split last).
9. **Recommended next phase:** **Phase 4C — Tenant Design & Migration Rehearsal (still read-only
   until D-1…D-7):** tenant data model doc (universities/memberships/scoped uniques/RLS + SECURITY
   DEFINER delta + Storage prefix), staging benchmark, grant-hardening staging tests, then
   migration rehearsal on an isolated copy. **Stop after Phase 4B — wait for explicit approval.**
