# 12 — Domain F: Class & Membership

> **Status:** DRAFT. **CONFIRMED** = brief decision; VERIFIED = repo evidence.

## 12.1 What exists today (VERIFIED)

From `20261029000900_classes.sql`:

```sql
classes(id uuid PK, slug text UNIQUE, name, description, course_id uuid NOT NULL → courses RESTRICT,
        course_name, institution, lecturer_name, semester text NOT NULL, academic_year text NOT NULL,
        status CHECK (active, archived), created_by → auth.users SET NULL, ...)
class_members(class_id uuid, user_id uuid, joined_via CHECK (invitation, admin_assignment, platform_assignment),
              joined_at timestamptz, PK (class_id, user_id))
```

- `class_members.joined_via` records **how** each membership originated (VERIFIED).
- `class_members` has **no end date** — removal is a hard DELETE (cascade on user deletion).
- Slug uniqueness is currently **global** (`classes_slug_key` UNIQUE `20261029000900`), not per-university (multi-tenant risk; see §12.3).
- Classes carry a single `course_id` (their "home course") + free-text `institution`/`lecturer_name`/`semester`/`academic_year`.
- Lifecycle: `status (active, archived)` + lifecycle migration `20261031180000_class_lifecycle.sql` (VERIFIED present; full state machine REPORTED in Phase 4B docs).

## 12.2 Ownership, uniqueness, cohort / program / entry-year relations

- **Ownership (RECOMMENDED):** `classes.university_id uuid NOT NULL → universities` (TENANT_OWNED). No owner user column needed — administration is via `class_admin_assignments` (see `15`).
- **Uniqueness (RECOMMENDED):** `UNIQUE (university_id, home_code)` where `home_code` is the cohort code (e.g. `IF-2024-A`). Replaces the global slug unique (slug becomes display/URL hint, `UNIQUE (university_id, slug)` if kept).
- **Cohort/program/entry-year (CONFIRMED):** Class = cohort (IF-2024-A); Entry Year is a fixed cohort attribute on `student_identities.entry_year` (see `11`, ADR-004) and mirrored read-only on `classes.entry_year` for filtering — class code encodes cohort at creation; Entry Year never changes.
- **Program relation (RECOMMENDED):** `classes.unit_id uuid NULL → academic_units` (flexible generalized units, `09`). Replaces free-text `classes.institution`/`lecturer_name` as structural facts (lecturer_name kept as display only — lecturer roles NOT confirmed).

## 12.3 Home-class model (CONFIRMED)

- **CONFIRMED:** student normally in one home class; auto access to home class courses.
- **RECOMMENDED:** `class_memberships.is_home bool DEFAULT true`, with a partial unique index `one_active_home_membership ON (student_identity_id) WHERE is_home AND left_at IS NULL` (see `27`). Home-class members see all home `course_offerings` without explicit `enrollments` rows (derived access, `13`).
- Course enrollment (retake) is independent and does NOT change home class / Entry Year (CONFIRMED).

## 12.4 Membership start/end dates + transfer history (RECOMMENDED)

- **RECOMMENDED:** add `left_at timestamptz NULL` to `class_memberships` (soft end) and `joined_via` (existing CHECK values preserved) + `transferred_from_class_id uuid NULL` for cohort transfers.
- Transfer history: moving home class = `left_at` on old row + new row with `joined_via = 'transfer'` (RECOMMENDED new CHECK value — requires CHECK rewrite like `20261107000000` did for attendance).
- History queries (attendance denominators, grade transcriptions) join through membership intervals, not just current rows.

## 12.5 Multiple classes — UNRESOLVED (explicitly)

- **UNRESOLVED:** may one `student_identities` row hold non-home memberships in multiple classes simultaneously (beyond retake enrollments)?
- Evidence: `class_members` composite PK allows many rows per user (VERIFIED); `class_invitation_acceptances` unique `(invitation_id, user_id)` (VERIFIED) — data model permits it, product rule does not confirm it.
- **RECOMMENDED interim rule:** non-home class memberships allowed via invite/admin add (existing `joined_via` semantics preserved); they grant class-space access but NOT home-offering auto access (only home membership does). Flagged for owner confirmation in `36`.

## 12.6 Target tables (summary; full spec in `26`)

- `classes(id, university_id, unit_id nullable, home_code, entry_year, status draft/active/archived, ...)`
- `class_memberships(id, class_id, student_identity_id, is_home, joined_via, joined_at, left_at, transferred_from_class_id, ...)`

**Cross-refs:** `06`, `08`, `09`, `10`, `11`, `13`, `14`, `15`, `23` (§23.3), `26` §26.1, ADR-005, `36` item 12 (multi-class UNRESOLVED).
