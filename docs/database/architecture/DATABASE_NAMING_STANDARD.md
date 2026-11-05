# Database Naming Standard — StarsTask (Proposed)

> **Purpose:** proposed conventions for **future** database objects.
> **Type:** READ-ONLY proposal. No existing object is renamed by this document.
> **Generated:** 2026-11-04 (Phase 4A), based on the verified catalog in
> [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md).
> **Status:** Pending approval. Existing objects stay as-is until a candidate in
> [ARCHITECTURE_DECISION_REGISTER.md](./ARCHITECTURE_DECISION_REGISTER.md) is approved.

---

## 1. General principles

1. **snake_case everywhere**, ASCII lowercase letters, digits, single underscores. No camelCase,
   no `PUBLIC.` schema prefixes in names, no spaces.
2. **One concept, one name.** `checkin_` vs `check_in_` and `type` vs `assignment_type` are
   legacy inconsistencies — new objects must pick one term per concept and reuse it.
3. **Names describe the role, not the implementation.** Prefer `class_cohorts` over `classes_v2`;
   never encode version, tenant, or environment in names (environments are handled by
   deployment config, not schema names).
4. **PostgreSQL default names are acceptable** for auto-created objects (`<table>_pkey`,
   `<table>_<columns>_key`, `<table>_<columns>_fkey`), but explicit names are preferred when the
   name carries domain meaning. Auto-generated names must never contradict the explicit ones.

---

## 2. Table names

| Rule                 | Standard                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case                 | `snake_case`, **plural** noun: `classes`, `discussion_sessions`, `course_materials`.                                                                                |
| Junction tables      | `<a>_<b>`, both plural, ordered alphabetically: `class_members`, `saved_assignments`.                                                                               |
| History/audit tables | `<entity>_history`, `<entity>_audits`, `<entity>_logs`: `leave_request_history`, `attendance_correction_audits`.                                                    |
| Logs/events          | `<domain>_<event>_events` / `_logs`, never `_data`: `app_error_events`, `auth_activity_events`.                                                                     |
| Catalog/reference    | `<domain>_catalog` when the table is a global lookup: future `course_catalog` (existing `courses` stays).                                                           |
| Tenant root          | `universities`, `university_memberships` (future; see AD-07).                                                                                                       |
| No abbreviations     | Spell out: `university_id`, not `uni_id`. Documented exceptions that stay: `nim` (Indonesian student number, INFERRED from app usage) and `ocr` (industry acronym). |

**Existing conventions (VERIFIED):** all 52 public tables are snake_case plural. The only
conceptual collision is `classes` / `courses` / `class_subjects` (see AD-01–AD-03) — a
**legacy exception**, not a pattern to copy.

---

## 3. Column names

| Rule              | Standard                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case              | `snake_case`.                                                                                                                                                                                  |
| Primary keys      | `id` for surrogate `uuid` PKs. Composite PKs: `<entity>_id` columns in alphabetical order (`class_id`, `user_id`). Single-column natural PKs: the business key (`key`, `user_id`).             |
| Foreign keys      | `<referenced_table_singular>_id`: `class_id`, `subject_id`, `user_id`, `course_id`. The referenced table is `public.<table>`; cross-schema FKs use `<entity>_id` referencing `auth.users(id)`. |
| Timestamps        | `*_at` (`timestamptz`): `created_at`, `updated_at`, `starts_at`, `ends_at`, `opens_at`, `closes_at`, `joined_at`.                                                                              |
| Dates             | `*_date` (`date`): `start_date`, `end_date`, `meeting_date`.                                                                                                                                   |
| Durations         | `*_minutes`, `*_seconds`, `*_days` with integer type: `late_after_minutes`.                                                                                                                    |
| Distances/areas   | `*_m` (meters): `checkin_radius_m`.                                                                                                                                                            |
| Status fields     | `<domain>_status` or bare `status` on the owning table: `status`, `attendance_status`. Values are CHECK-constrained text unless an enum is explicitly approved.                                |
| Type fields       | `<entity>_type`: `assignment_type`, `session_type`. Never bare `type` on new objects (legacy `type` usage is an exception).                                                                    |
| Booleans          | `is_*`, `has_*`, or `allow_*` question form: `is_class_member`, `is_public`.                                                                                                                   |
| Counts            | `<thing>_count`: `member_count`, `attempt_count`.                                                                                                                                              |
| Text length pairs | `name`, `description`, `title` — never `name_text` or `desc`.                                                                                                                                  |
| Tenant            | `university_id` (`uuid` → `universities(id)`). Never `tenant_id` or `org_id` on new objects.                                                                                                   |

**Legacy exceptions (keep, do not copy):** `checkin_latitude/longitude/radius_m` (no
underscore; future columns use `check_in_*`), `nim` (documented acronym), `classes.course_name`
(denormalized legacy copy — new denormalization requires a written reason).

---

## 4. Primary keys

- Surrogate: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- Junction/membership: composite `<entity>_id` PK, e.g. `PRIMARY KEY (class_id, user_id)`.
- Key-value/tokens: single-column natural PK (`key`).
- **Never** integer identity PKs in `public`, `SERIAL`/`BIGSERIAL`, or `id` of non-`uuid` type.
- PK constraint name: `<table>_pkey` (PostgreSQL default).

**Existing state (VERIFIED):** 44 `id uuid` PKs, 4 composite PKs (`class_members`,
`class_admins`, `assignment_completions`, `leave_request_forwarding_items`), 4 single-column
natural PKs (`rate_limits.key`, `notification_preferences.user_id`, `platform_admins.user_id`,
`google_calendar_connections.user_id`). Total 52 PKs = 52 tables.

---

## 5. Foreign keys

- Name: `<source_table>_<columns>_fkey`, columns joined by `_` in declared order:
  `class_admins_class_id_user_id_fkey`.
- Column order in a composite FK = PK column order of the referenced table:
  `class_admins(class_id, user_id) → class_members(class_id, user_id)`. **Never** duplicate or
  reorder columns when documenting or generating (Phase 4A bug §2).
- `ON DELETE` semantics:
  - `CASCADE` — child is a pure extension of the parent (members, admins, invitations, evidence, check-ins).
  - `SET NULL` — child survives with a dangling reference allowed (reviews, revisions, applications).
  - `RESTRICT` — parent must not disappear while children exist (catalogue `courses`).
- `ON UPDATE` default: `NO ACTION` (PostgreSQL default; uuid PKs are never updated in practice).
- Deferrable: no deferrable FKs by default; deferrable requires a documented ordering reason.
- Referencing `auth.users(id)`: always `ON DELETE SET NULL` unless deletion of the user must also
  delete the row — decided per table with the CASCADE-risk review (P0-3).

**Existing state (VERIFIED):** 112 FKs, 1 composite FK (`class_admins → class_members`),
0 deferrable, 0 self-referencing.

---

## 6. Unique constraints

- Name: `<table>_<columns>_key`; partial uniques use `<table>_<purpose>_key`
  (`class_subjects_class_code_uniq` is a legacy exception, keep).
- Scoped uniqueness by default: `(<tenant_or_owner>, <business_key>)`. Global uniqueness
  requires a written reason (catalogue keys like `courses_normalized_name_key` are the exception).
- Partial unique indexes (e.g. `WHERE code IS NOT NULL`) must be documented with the NULL rule.
- Error surfaces: unique-violation messages must never leak tenant/user existence; RPCs catch
  `unique_violation` and return generic codes.

**Existing state (VERIFIED):** 18 unique constraints + partial unique indexes
(`class_subjects_class_code_uniq`, `discussion_sessions_class_subject_meeting_uniq`,
`classes_period_code_key`).

---

## 7. Check constraints

- Name: `<table>_<column>_length`, `<table>_<column>_allowed`, `<table>_<column>_range`,
  `<table>_<column>_format`, or `<table>_<purpose>` for cross-column rules
  (`discussion_sessions_meeting_identity`, `discussion_sessions_attendance_state`).
- Status values: `<table>_<column>_allowed` CHECK with `= ANY (ARRAY[...])`.
- Length: `char_length(btrim(col))` between min/max, col nullable-guarded.
- Format: regex `~` CHECK (`classes_academic_year_format`, `classes_slug_format`).
- Range: numeric bounds CHECK (`*_range`).
- Cross-column: named after the invariant, documented with the comment on the table.
- Messages are not user-facing; RPCs translate violations to stable error codes.

**Existing state (VERIFIED):** 250 CHECK constraints — the dominant constraint type, which is
why statuses are CHECK-text rather than enums.

---

## 8. Indexes

- Name: `<table>_<purpose>_idx` (`class_members_user_idx`, `discussion_sessions_upcoming_idx`).
- Partial indexes declare the predicate in the name purpose (`_active_`, `_open_`) and in docs.
- Every FK column should be covered by an index unless the FK targets a PK and the parent is
  tiny — verify with `pg_stat_user_indexes` before adding.
- GIN indexes for arrays/tsvector (`assignments_tags_idx`, `assignments_search_idx`).
- `IF NOT EXISTS` in migrations; index creation inside a migration transaction only for
  `CREATE INDEX` on small tables — large tables use `CREATE INDEX CONCURRENTLY` outside a
  transaction with the migration split documented.
- No index without a measured access path: `EXPLAIN ANALYZE` / `pg_stat_statements` evidence
  before adding, duplicate removal only after the same evidence (see INDEX_CATALOG).

**Existing state (VERIFIED):** 175 indexes across 52 tables.

---

## 9. Functions

| Rule          | Standard                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case          | `snake_case` verbs: `create_*`, `get_*`, `list_*`, `check_in_*`, `record_*`, `review_*`, `purge_*`.                                                                       |
| Domain prefix | One prefix per domain: `class_*`, `attendance_*`, `leave_*`, `notification_*`, `session_*`. Mixed prefixes (`attendance_correction_*` + `class_attendance_*`) are legacy. |
| Check-in      | `check_in_*` (with underscore) on new functions; `checkin_*` columns are legacy.                                                                                          |
| Parameters    | `p_*` prefix for RPC arguments; eligibility checks use explicit names (`p_class_id`, `p_user_id`).                                                                        |
| Security      | `SECURITY DEFINER` only when the function must bypass RLS, always with `SET search_path TO ''` or `public, pg_temp` (declared in `proconfig`), owner `postgres`.          |
| Volatility    | `STABLE` for reads, `VOLATILE` for writes.                                                                                                                                |
| Grants        | `EXECUTE` granted explicitly (`authenticated`, `service_role`); never rely on `PUBLIC` defaults.                                                                          |
| Comments      | Every public function carries `COMMENT ON FUNCTION` stating purpose, caller, and security contract.                                                                       |

**Existing state (VERIFIED):** 158 local / 159 production functions, 142/143 SECURITY DEFINER.
Production-only `rls_auto_enable()` is drift, not a pattern (see PHASE_4A §3).

---

## 10. Triggers

- Name: `<table>_<action>` (`set_updated_at`, `ensure_subject_in_class`, `prevent_assignment_owner_change`).
- Timing first word, one action per trigger, `<table>` prefix for discoverability.
- Trigger functions live in `public` and are named after the invariant they enforce.
- `set_updated_at()` is the shared utility; new `updated_at` columns reuse it — never duplicate logic.

**Existing state (VERIFIED):** 40 triggers across tables, all non-internal.

---

## 11. Enum and custom types

- `public` types follow PostgreSQL storage. **No new enum/composite/domain types without
  approval** — the existing standard is CHECK-constrained `text` for statuses and types
  (250 CHECKs vs 0 enum types VERIFIED).
- If an enum is approved: `snake_case` singular (`attendance_status`), values `snake_case`,
  named `<domain>_<concept>_status`, created via `CREATE TYPE ... AS ENUM` in a migration with
  a rollback that renames the column back to `text`.
- Table row types (`typtype='c'`, auto-generated) are **not** domain types — never reference
  them in application code.

**Existing state (VERIFIED):** 52 auto row types + 52 auto array types, 0 user-defined types of
any kind, in both environments.

---

## 12. Timestamps, status columns, boolean columns

- Timestamps: `timestamptz`, `*_at`, `DEFAULT now()` on insert, `updated_at` maintained by
  `set_updated_at()` trigger. Instants are UTC; display timezone lives in the app
  (`discussion_sessions.time_zone`, IANA name, documented purpose: display + calendar link).
- Calendar dates: `date`, `*_date`, no timezone arithmetic in SQL.
- Status columns: `text` + `<table>_<column>_allowed` CHECK; statuses are lowercase `snake_case`
  (`scheduled`, `cancelled`, `completed`, `published`, `present`, `late`, `excused`, `sick`,
  `absent`). Never reuse one status word for two meanings across domains.
- Booleans: `is_*`/`has_*`; store `NOT NULL DEFAULT false` unless NULL is a distinct state.

---

## 13. Tenant identifiers

- Column: `university_id uuid` → `universities(id)`, `NOT NULL` on tenant-owned tables
  after backfill (nullable only during the migration window).
- Name: `university_id` only. No `tenant_id`, `org_id`, `institution_id`.
- Free-text `institution` is legacy — new institution references are FKs.
- Storage paths: `<university_id>/<class_id>/<file>` prefix (future; existing buckets
  use `auth.uid()` folder prefix).
- RLS: `university_id = current_tenant()` **in addition to**, never instead of, class checks.
- Uniqueness includes `university_id` first (AD-08).
- Global tables are listed explicitly (initially: none except possibly `courses` pending AD-02).

---

## 14. Legacy exceptions register (do not copy)

| Existing object                                          | Exception                | Replacement for new objects                         |
| -------------------------------------------------------- | ------------------------ | --------------------------------------------------- |
| `checkin_latitude/longitude/radius_m`                    | missing underscore       | `check_in_*`                                        |
| `classes.course_name`, `assignments.semester`            | denormalized text copies | FK to catalogue/subject                             |
| `classes.institution`                                    | free text, no FK         | `university_id` FK                                  |
| `class_subjects_class_code_uniq`                         | `_uniq` suffix           | `_key` suffix                                       |
| `discussion_sessions` dual role                          | two domains, one table   | separate tables or RPC role checks                  |
| `type` (legacy RPC param `p_type` in `list_assignments`) | bare `type`              | `assignment_type` / `session_type`                  |
| `rls_auto_enable()` (production only)                    | drift, not in repo       | reproduce in a migration or drop — decision pending |

---

## 15. Review checklist for new database objects

1. Does the name reuse an existing concept's name? If not, why not.
2. Is the table plural and the FK column `<singular>_id`?
3. Are timestamps `*_at` (`timestamptz`), dates `*_date`, statuses CHECK-text?
4. Does every FK have a covering index and an explicit `ON DELETE` decision?
5. Are uniques scoped (tenant/owner first) with the NULL rule documented?
6. Is `SECURITY DEFINER` justified, with `search_path` and grants declared?
7. Is there a migration + rollback plan, and a backup gate for high-risk changes?
