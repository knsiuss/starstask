# Phase 5H — Phase 5C–5F Verification (Academic Structure, Enrollment, Operations, Communication)

## 5C Academic Structure — **PARTIALLY VERIFIED** (schema yes; catalog separation incomplete; app absent)

- `academic_years`: `university_id` RESTRICT, code/name checks, date order, status CHECK
  (`planned/open/closed/archived`), partial unique one-current per university, `(id, university_id)` support unique. VERIFIED.
- `semesters`: composite FK `(academic_year_id, university_id) → academic_years`; **cross-university semester rejected**
  by FK (validation SQL proves `foreign_key_violation` path); unique scoped `(university_id, academic_year_id, lower(btrim(code)))`. VERIFIED.
- `classes`: additive columns `university_id`, `academic_unit_id`, `academic_year_id`, `semester_id`, `entry_year`, `code`;
  `entry_year` range CHECK; composite "same-university" FKs for unit/year/semester; `UNIQUE(id, university_id)`;
  unique `university_id, status` index partial WHERE NOT NULL. Legacy data preserved (MATCH SIMPLE skips NULLs). VERIFIED.
- `course_offerings` + `enrollments`: catalog vs delivery vs participation exist as separate tables. However **catalog remains
  global `courses` with nullable `university_id`** — ADR/decision #2 (catalogue scope) unresolved; courses are **not yet
  university-scoped catalogs**. Catalog ≠ offering is structurally implemented, **not functionally scoped**. PARTIAL.
- Schedules: `schedule_rules`, `schedule_instances`, `schedule_exceptions` created by same migration.
  Timezone is per-`university` field (`timezone` on universities) but rules carry explicit `starts_at`; duplication prevention
  exists via instances uniqueness (per file review) — **not exhaustively checked row-by-row**; treated PARTIALLY VERIFIED.
- `enrollments`: supports home vs retake (`source` column), prevents duplicate active enrollment by trigger/test,
  cross-university rejection tested. Retake does not mutate home. VERIFIED design.
- No app integration for any of these domains (grep shows only type imports). DATABASE ONLY.

## 5D Enrollment and RBAC — **PARTIALLY VERIFIED** (schema yes; usage policy unresolved; app absent; guard weak)

- `class_memberships`: one active row per `(class_id, student_identity_id)` partial index; one home row per
  `student_identity_id` partial unique; composite FKs to classes/identities on `(id, university_id)`. VERIFIED.
- `course_invite_tokens` / `course_invite_acceptances`: hash-only `token_hash` CHECK length=64; `max_uses` 1–500;
  expiry/after/use-within-max CHECKs; acceptances unique per (token, redeemed_by); cross-university offering FK;
  acceptances have `enrollment_id` audit link. No invite creation RPC exists → no usable flow yet. Usage policy UNRESOLVED.
- `class_admin_assignments` + `class_admin_permissions`: normalized, 8 permission codes, `manage_admins` included;
  `has_class_permission(...)` RPC with `search_path=''`; REVOKE/GRANT EXECUTE split correct (anon/public denied, authenticated granted).
- `guard_last_class_admin` trigger: blocks revocation of the **final** assignment per class — but does not consider
  university membership or management powers; any admin could revoke admins as long as one remains. No `manage_admins`
  enforcement at the trigger layer; policy relies on RPC call sites that don't exist yet. Last-admin protection is
  DB-guard only; **bypass analysis:** direct INSERT of revocation-only paths is not exposed via client RLS (no write policy),
  so the gap is architectural, not exploitable today — but also **not functionally complete**.
- Cross-class isolation: policies key on row's university/class; no caller-widening. OK today.
- 15 business rules: **one home class** ✓ (DB partial unique); **outside/home enrollment** ✓; **duplicate prevented** ✓;
  retake↛home ✓ (design); multi-admin ✓; presets/groups — presets/permissions only, **no permission-group table exposed to users**;
  retakes across class require verified membership + university consistency ✓; RBAC authorization **not wired to any app path**.

**Decision gate:** Invite usage policy (#8) remains unresolved. Implementing default invitation use limits would be inventing business rules.

## 5E Academic Operations — **PARTIALLY VERIFIED** (schema + helper yes; grading CSV unresolved; app absent)

- `attendance_meetings`, `attendance_records`, `attendance_corrections` (append-only; `correction_reason` required;
  recorded_by/timestamp; FK to meeting/identity). Statuses VERIFIED five values via CHECK (`present/late/excused/sick/absent`);
  `not_applicable` rejected in tests — display-only. RLS enabled, anon denied. VERIFIED on disk.
- Attendance exports: existing Excel/PDF export code in app (`exceljs`, `pdf-lib`, attendance XLSX restyle) —
  legacy class-based exports, **not connected to new tables**. No new import path.
- Grading: `grade_batches`, `grade_entries`, `grade_history`, `validate_grade_entry(score, max_score)`. Verification/publication
  state and duplicate handling present at schema layer. **No CSV mapping implemented** (CSV format UNRESOLVED #1) — correct behavior.
- Legacy assignments/course materials: `university_id`/`offering_id` added nullable + composite FK; untyped paths still work.
- Storage buckets (verified from migration headers):
  - `assignment-attachments` — private, 10 MB, server-generated signed URLs, no public access.
  - `leave-evidence` — private, 10 MB (SELECT restricted to owner/class admin via dedicated policies).
  - `verification-evidence` — private, 10 MB.
  - `avatars` — **public**, 2 MB.
  - `class-media` — **public**, 4 MB (**public visibility intent is an open question** — verify with product owner).
  - No buckets created/dropped by 5A–5G; no policy weakening performed.

## 5F Communication — **PARTIALLY VERIFIED** (announcements built; chat NOT IMPLEMENTED; social gated)

- `announcements`, `announcement_reads`: class-scoped, author profiles-FK, publication state, pinned flag, read-marking unique /
  (announcement_id, user_id), class membership read policy. VERIFIED on disk; **no app wiring** (12 files match the word
  "Announcements" in nav/UI, but zero query `from("announcements")`). DATABASE ONLY.
- `discussion_threads`: created with visible "ISOLATED PROPOSAL" scope unresolved flag; read policy exists; **no write path, no app wiring**.
- Social feed: **not implemented** (ADR-016). Not a defect.
- **Chat gap (explicit): none of the following exist anywhere in the repo migration or app code — personal DM, group chat,
  conversation membership, messages, attachments, read receipts, reactions, moderation, permissions: NOT IMPLEMENTED.**
- Notifications: existing outbox (`notification_events`, `notification_deliveries`) extended with nullable `university_id`;
  recipient path unchanged; deduplication still application-level. Broader in-app notifications for the new domain do not exist.

## 5G Security — **PARTIALLY VERIFIED** (static review only; no live negative-test execution)

- Audit: `audit_logs` + `university_id`, `before_state/after_state` jsonb object CHECKs, entity/university indexes. Tamper resistance
  remains append-only convention; direct UPDATE of `audit_logs` by anon/authenticated denied (no write grant); no immutable constraint
  on existing rows — **NOT VERIFIED as tamper-proof** (requires DB-level trigger to be airtight).
- Anon re-denial re-applied to all new tables; new tables enabled RLS + SELECT-only grants. VERIFIED.
- New SECURITY DEFINER code uses `search_path=''` and object qualification. Legacy definers (`is_class_member`, `record_audit`,
  etc.) remain REPORTED watch-items, not rewritten.
- No production exposure; no secrets in docs; no destructive steps taken in this phase.
