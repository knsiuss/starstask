# Phase 5B — Decision Register

> ADR-002 has never received a Platform Admin sign-off inside this
> repository, and 5B does not fabricate one. Because a separate _activation_
> pipeline was still needed (registry ≥ → active gating is the still
> unresolved risk), we resolved implementation as assuming ADR-002 approved
> only for the integer in 5A (building the registry table itself). Status:
> **"IMPLEMENTATION-JUSTIFIED, PENDING PLATFORM SIGN-OFF"**. This register
> follows the ADR entries verified in this session; gates hold wherever
> §below names any ambiguity or missing approval.

## Decision table

### D-01 — ADR-002 (single-table registry) final status

- **Basis:** 5A now ships `universities` (single table, `status` lifecycle:
  `registered → pending → active → suspended → inactive`, VERIFIED in
  `20261111000000_universities_and_memberships.sql:22-71`). 5B added no
  activation/installation of the single-table approach; 5B's new tables
  reference `universities` as the tenant root, which is exactly the surface
  ADR-002 governs.
- **DECISION:** ADR-002 is marked **APPROVED–IMPLEMENTATION-JUSTIFIED**
  (implementation evidence, not Platform Admin sign-off).
- **Recorded distinction:**
  - Registry _is_ single-table (table-level).
  - "Registry separate from activation/authorization" is preserved:
    registry rows ≠ authorized tenants; a row's `status` alone decides read
    visibility; users cannot activate universities; platform membership
    requires a platform-admin RPC.
  - Users cannot activate: no client write policy on `universities` or any
    5B table (VERIFIED §27/§37 of `evidence-closure.md` and migration).
- **Remaining gate (explicit):** Platform Admin sign-off is still required
  before (a) any production registry row, (b) enforcing tenant predicates
  in RLS of pre-existing tables, (c) any UI for creation/activation.
- **Owner:** Platform team, 2026-11-04. Status: **APPROVED (implementation-justified)**.

### D-02 — Composite FK vs trigger for cross-university parent prevention

- **Chosen:** composite FK `academic_units(parent_id, university_id) →
academic_units(id, university_id)` + `UNIQUE(id, university_id)` on
  parents.
- **Fallback rejected:** trigger-only enforcement duplicates FK semantics
  and is race-prone; a simple self-FK alone cannot express "same
  university". Composite FK is index-backed, declaration-level, and race-free.
- **Evidence:** 5B tests: cross-university parent insert → FK violation
  (`academic_units_parent_same_university`). MATCH SIMPLE means `parent_id
IS NULL` skips the check (top-level units work).

### D-03 — Cycle prevention: trigger vs recursive-CTE/DFS function

- **Chosen:** `BEFORE INSERT OR UPDATE OF parent_id` trigger that walks
  ancestors from `NEW.parent_id`, advisory-lock-serialized, 1000-hop guard.
- **Tradeoff:** cycles require a parent chain that already loops to the
  write target; an ancestor walk detects exactly that. Lock covers the
  concurrent re-parent race. We did **not** materialize a `path` column in
  5B (§09 RECOMMENDs it later; 5B stays minimal).

### D-04 — Code-uniqueness scope

- Scope: `(university_id, parent_id, code)`, case-insensitive on code.
  Two partial unique indexes because Postgres treats NULLs as distinct in
  plain unique constraints; the top-level scope is its own partial index.
- Rationale: §23.3 matrix + VERIFIED evidence (sibling codes must be
  unique; different parents may reuse names).

### D-05 — One identity per membership; `student_identities` normalized to memberships

- **Decision:** `student_identities` is a strict extension of
  `university_memberships`: `UNIQUE(university_membership_id)`, composite
  FK on `(university_membership_id, university_id)`, denormalized
  `university_id` (composite-checked) so tenant scans need no join.
- **Identity ≠ membership**: a membership may have no identity row (not
  every member is a student). 5B adds **no columns** to
  `university_memberships` except the `UNIQUE(id, university_id)` support
  index.
- **Separation:** membership = persona bridge (user ↔ university, role,
  status). Identity = academic detail (student_id, entry_year, unit,
  started/graduated lifecycle). Membership `student_id`/`entry_year`
  columns from 5A remain legacy mirrors; 5B writes only membership `status`
  (mirror sync), never its academic columns.

### D-06 — `entry_year` nullability

- NULLABLE in the expand phase (CHECK 1950–2100 preserved), per 5A's
  precedent for nullable cohort fields on the bridge tables.
- Contract step (deferred): tighten to `NOT NULL` once verified identities
  always carry a cohort year.

### D-07 — Graduated reactivation rule

- **Rule (documented, migration-enforced):** a `graduated` identity may be
  reactivated to `active` on the **same row** via the platform RPC. The
  RPC clears `graduated_at` and preserves `started_at` (stable identity;
  one identity per membership also forbids a fresh row per re-enrollment).
- Suspended → active follows the same RPC path; enrollments-is-alive
  concerns are deferred to Phase 5C+.

### D-08 — Public reads: own university's units, own identity only

- `academic_units`: read when caller holds an **active** membership at
  that university (`is_university_member`) or is a platform admin.
- `student_identities`: read own rows only (per §11.3 no cross-user
  identity exposure); platform admin sees all.
- Anon: denied on both tables (no grant + no policy).

### D-09 — Platform RPC scope (no self-grant, no self-admin-assignment)

- `platform_upsert_student_identity` reuses `is_platform_admin()` (existing
  mechanism; `evidence-closure.md` §4).
- It **cannot** create `platform_admins` rows, cannot create
  `university_memberships` rows, and cannot be executed by anon
  (REVOKE … FROM public, anon, authenticated; GRANT EXECUTE to
  authenticated; admin check inside).
- It validates same-university membership/unit pairing, mirrors
  membership `status`, sets `started_at`/`graduated_at`, writes
  `audit_logs` via `record_audit`, and returns the identity id.

### D-10 — Legacy NIM: preserve, do not dual-write

- `profiles.nim` + `profiles_nim_unique` are untouched. Safe dual-write to
  `student_identities` is impossible today: legacy NIM uniqueness is
  **global** while identity uniqueness is **per-university**, so two valid
  legacy rows (same NIM string, different free-text universities) would
  collide on the identity unique index. Any dual-write would also need
  the fuzzy `profiles.university` → registry mapping (UNRESOLVED, §30.3).
- Decision: preserve current onboarding behavior; dual-write + contract
  is a separate, later migration gated on registry mapping approval.
