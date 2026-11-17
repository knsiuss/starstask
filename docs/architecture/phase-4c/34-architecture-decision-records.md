# 34 — Architecture Decision Records (ADR-001…ADR-018)

> **Status:** DRAFT. **APPROVED** only where CONFIRMED basis is strong; else **PROPOSED**. Each ADR carries the 12 fields.

### ADR-001 — One global account, per-university personas

- Context: single Google login must serve independent per-university memberships.
- Decision: one global `profiles` + per-university `student_identities`.
- Alternatives: per-university accounts (rejected — CONFIRMED forbids).
- Consequences: identity bridge complexity in migration.
- Status: **APPROVED** (CONFIRMED brief basis).
- Migration impact: bridge table + backfill (Phase 5B).
- Security: RLS keys off `student_identity_id`.
- Performance: extra join on auth-sensitive paths (benign).
- Compatibility: expand-contract preserves old `profiles` cols until cutover.
- Rollback: flip flag; old columns retained.
- Owner: Platform team. Date: 2026-11-04.

### ADR-002 — Single-table tenant registry with status lifecycle

- Context: CONFIRMED lifecycle registered→pending→active→suspended→inactive.
- Decision: single `universities` table + `status`.
- Alternatives: separate tenant table (rejected — cost).
- Consequences: simpler queries; lifecycle in one column.
- Status: **PROPOSED** (RECOMMENDED; owner approval pending).
- Migration impact: NEW table; tenant columns phased in.
- Security: status gate in RLS (active-only).
- Performance: predicate `university_id + status` indexable.
- Compatibility: additive.
- Rollback: drop table only before backfill.
- Owner: Platform team. Date: 2026-11-04.

### ADR-003 — Generalized academic unit model (not fixed hierarchy)

- Context: CONFIRMED flexibility, no Indonesian hardcoding.
- Decision: `academic_units` with free `unit_type` + `path`.
- Alternatives: fixed faculty/department (rejected — CONFIRMED).
- Consequences: flexible org trees; subtree via path/CTE.
- Status: **APPROVED** (CONFIRMED basis).
- Migration impact: NEW; deprecate `courses.department`.
- Security: tenant-owned.
- Performance: path prefix queries.
- Compatibility: additive.
- Rollback: keep legacy column until cutover.
- Owner: Platform team. Date: 2026-11-04.

### ADR-004 — Entry Year separate from period/membership/enrollment

- Context: CONFIRMED fixed-cohort separation.
- Decision: `entry_year` on `student_identities`; periods independent.
- Alternatives: derive from class code (rejected — fragile).
- Consequences: explicit cohort data.
- Status: **APPROVED** (CONFIRMED).
- Migration impact: backfill from class codes (best-effort) + manual review.
- Security: immutable post-activation.
- Performance: none.
- Compatibility: additive.
- Rollback: n/a.
- Owner: Platform team. Date: 2026-11-04.

### ADR-005 — Class = cohort (IF-2024-A)

- Context: CONFIRMED cohort model.
- Decision: `classes.home_code` + `entry_year`.
- Alternatives: class = course instance (rejected — CONFIRMED forbids).
- Consequences: one class → many offerings.
- Status: **APPROVED** (CONFIRMED).
- Migration impact: MODIFY `classes`.
- Security: class-scoped.
- Performance: none.
- Compatibility: existing `classes` retained.
- Rollback: dual-write.
- Owner: Platform team. Date: 2026-11-04.

### ADR-006 — Three-layer course model (catalog/offering/enrollment)

- Context: retake + home-class auto access (CONFIRMED).
- Decision: `courses` / `course_offerings` / `enrollments`.
- Alternatives: single table (rejected — cannot express retake).
- Consequences: clean lifecycle separation.
- Status: **PROPOSED** (RECOMMENDED; catalog scope UNRESOLVED).
- Migration impact: MERGE/RENAME as in `29`.
- Security: derived access for home class.
- Performance: composite indexes.
- Compatibility: expand-contract.
- Rollback: reads flip back.
- Owner: Platform team. Date: 2026-11-04.

### ADR-007 — Course Invite Tokens: hash-only, usage-limited (default 10 uses / 30 days)

- Context: CONFIRMED secure tokens; usage default to be RECOMMENDED.
- Decision: `SHA-256` hash-only, RPC redemption, RECOMMENDED default 10 uses/30-day expiry.
- Alternatives: unlimited tokens (rejected — leakage); single-use-only (rejected — shareability).
- Consequences: revocable, auditable.
- Status: **PROPOSED** (default policy needs owner sign-off).
- Migration impact: NEW tables.
- Security: hash-only; no plaintext at rest.
- Performance: single PK lookup on redeem.
- Compatibility: additive.
- Rollback: disable RPC.
- Owner: Platform team. Date: 2026-11-04.

### ADR-008 — Class Admin RBAC: normalized permissions + last-admin guard

- Context: CONFIRMED multiple admins, granular perms, manage_admins-gates-admins, last-admin protection.
- Decision: `class_admin_assignments` + `class_admin_permissions` + trigger guard.
- Alternatives: flag columns (rejected — cannot extend).
- Consequences: clean extension.
- Status: **APPROVED** (CONFIRMED basis for rules; schema PROPOSED).
- Migration impact: SPLIT `class_admins`.
- Security: class-scoped, no spillover.
- Performance: two-join checks.
- Compatibility: dual-write.
- Rollback: old table retained until cutover.
- Owner: Platform team. Date: 2026-11-04.

### ADR-009 — Attendance: explicit meetings, append-only corrections

- Context: CONFIRMED per-meeting + history + export.
- Decision: `attendance_meetings` + `attendance_records` + `attendance_corrections`.
- Alternatives: reuse session container only (rejected — course scope implicit).
- Consequences: explicit offering linkage.
- Status: **PROPOSED**.
- Migration impact: NEW + RENAMEs.
- Security: manage_attendance-gated.
- Performance: batch inserts.
- Compatibility: exports preserved.
- Rollback: old checkins retained.
- Owner: Platform team. Date: 2026-11-04.

### ADR-010 — Grading: batches + verify→publish + append-only history

- Context: CONFIRMED CSV upload by class admin.
- Decision: `grade_batches/entries/history`.
- Alternatives: in-place score edits (rejected — CONFIRMED history).
- Consequences: auditable grades.
- Status: **PROPOSED** (format UNRESOLVED).
- Migration impact: NEW (no existing data).
- Security: manage_grades-gated publish.
- Performance: bulk parse.
- Compatibility: additive.
- Rollback: disable import RPC.
- Owner: Platform team. Date: 2026-11-04.

### ADR-011 — Schedule: rules + materialized instances + exceptions

- Context: CONFIRMED recurrence/meetings/exceptions + per-university timezone.
- Decision: three-table model.
- Alternatives: weekly rows only (rejected — no exceptions).
- Consequences: queryable calendar.
- Status: **PROPOSED**.
- Migration impact: SPLIT `class_course_schedules`.
- Security: class-scoped.
- Performance: materialization batches.
- Compatibility: parallel read.
- Rollback: old table retained.
- Owner: Platform team. Date: 2026-11-04.

### ADR-012 — Announcements as separate formal channel

- Context: CONFIRMED separation from social/discussions.
- Decision: `announcements` table.
- Alternatives: reuse posts (rejected — formal channel needs guarantees).
- Consequences: distinct fan-out (push).
- Status: **PROPOSED**.
- Migration impact: NEW.
- Security: manage_announcements-gated.
- Performance: none.
- Compatibility: additive.
- Rollback: n/a.
- Owner: Platform team. Date: 2026-11-04.

### ADR-013 — Tenant isolation via composite FKs (plus direct keys)

- Context: prevent cross-tenant pairings at DB level.
- Decision: `UNIQUE (id, university_id)` + composite child FKs.
- Alternatives: app-only checks (rejected — bug-prone).
- Consequences: DB-enforced isolation.
- Status: **PROPOSED** (RECOMMENDED).
- Migration impact: adds unique + FKs.
- Security: defense in depth.
- Performance: index-backed.
- Compatibility: additive.
- Rollback: drop FKs.
- Owner: Platform team. Date: 2026-11-04.

### ADR-014 — Keep API cron (not pg_cron) for retention/fan-out

- Context: VERIFIED API cron routes, pg_cron absent.
- Decision: retain API cron + server RPCs.
- Alternatives: pg_cron (PROPOSED future).
- Consequences: deploy-model consistency.
- Status: **PROPOSED**.
- Migration impact: none.
- Security: cron secret headers stay.
- Performance: worker lag measurable.
- Compatibility: none.
- Rollback: n/a.
- Owner: Platform team. Date: 2026-11-04.

### ADR-015 — SECURITY DEFINER predicates KEEP (recursion avoidance)

- Context: `is_class_member()` etc. must bypass RLS-recursion.
- Decision: KEEP with `search_path=''` + narrow EXECUTE.
- Alternatives: INVOKER (rejected — breaks auth).
- Consequences: continued definer surface to audit.
- Status: **APPROVED** (VERIFIED repo comment basis).
- Migration impact: tenant-guard extension only.
- Security: grants narrowed.
- Performance: EXISTS index-friendly.
- Compatibility: call sites unchanged.
- Rollback: n/a.
- Owner: Platform team. Date: 2026-11-04.

### ADR-016 — Social feed excluded from target until confirmed

- Context: brief marks social candidate-only.
- Decision: exclude from mandatory schema.
- Alternatives: build speculatively (rejected — scope).
- Consequences: no feed tables in `26` mandatory specs.
- Status: **APPROVED** (CONFIRMED candidate basis).
- Migration impact: none.
- Security: n/a.
- Performance: n/a.
- Compatibility: additive later.
- Rollback: n/a.
- Owner: Platform team. Date: 2026-11-04.

### ADR-017 — Direct + inherited tenant keys (matrix in `23`)

- Context: efficiency vs simplicity.
- Decision: direct for OWNED, composite-inherited for DERIVED.
- Alternatives: direct everywhere (drift risk).
- Consequences: integrity at cost of a few composite FKs.
- Status: **PROPOSED**.
- Migration impact: phased.
- Security: strongest.
- Performance: one extra join avoided.
- Compatibility: additive.
- Rollback: drop constraints.
- Owner: Platform team. Date: 2026-11-04.

### ADR-018 — Expand-contract migrations only

- Context: live data + no downtime tolerance.
- Decision: expand → dual-write → cutover → contract.
- Alternatives: big-bang (rejected — rollback impossible).
- Consequences: slower but safe.
- Status: **PROPOSED** (RECOMMENDED).
- Migration impact: every phase follows it.
- Security: dual-write drift checks.
- Performance: backfill batching.
- Compatibility: old shape live until contract.
- Rollback: flip reads.
- Owner: Platform team. Date: 2026-11-04.
