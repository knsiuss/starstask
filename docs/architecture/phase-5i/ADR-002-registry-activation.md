# ADR-002 — University Registry & Activation (DRAFT, pending owner sign-off)

**Date:** 2026-11-05
**Status:** NIM prefix LIVE 2026-11-05 (migration `20261120000000`, 31/31 identities → `UNPAM-...`); other decisions PROPOSED, pending owner sign-off before enforcement.

## Decisions

### 1. Registry

- `universities` is the single registry. Slug is canonical (`universitas-pamulang`, `seraphim`).
- Lifecycle: `registered -> pending -> active -> suspended/archived`. Only `active` universities grant academic access.
- Seraphim: created as `registered` (2026-11-05, id `e1fdf659-...`), profile `Bagas 73` untouched, no membership created. Activation requires owner mapping review. Owner decision 2026-11-05: leave Seraphim empty/unmapped — no activation, no membership, no identity.

### 2. Activation

- Platform Admin activates via service_role only. No auto-activation from profile text.
- Legacy `profiles.university` is display text only; mapping to registry is via `university_memberships`, reviewed in `university-mapping-dry-run.csv`.

### 3. Invite usage policy (36#8)

- No default invented. `course_invite_tokens.max_uses` and `expires_at` must be supplied explicitly at creation.
- Recommended pilot defaults for owner approval: `max_uses=50`, `expires_at=+30 days`, single-use per identity (unique on token+identity in acceptances).
- Until approved, invite creation RPC rejects missing policy fields.

### 4. Grading CSV format

- Proposed columns: `student_id, course_code, score, grade_letter, semester_code, academic_year_code`
- UTF-8, header row required, max 1000 rows, score 0-100 numeric. Publish is `draft -> published` with audit log; no overwrite of published rows.
- Pending owner approval; no grading publish path is live until then.

### 5. NIM uniqueness — PREFIXED format (owner idea 2026-11-05)

- Legacy: `profiles.nim` stays raw + global unique (untouched, until cutover).
- New model: `student_identities.student_id` = `{PREFIX}-{raw NIM}`, e.g. `UNPAM-241011400217`, `BRAWIJAYA-0000`.
- Prefix source: `universities.nim_prefix` (new column, migration `20261120000000_nim_prefix.sql`), derived from `short_name` (UNPAM), fallback `code`, fallback `slug`, uppercased alphanumeric.
- Existing CHECK `student_identities_student_id_format` already allows this format — no schema change needed there.
- Per-university unique index: `(university_id, lower(student_id))`. Same raw NIM in two universities becomes distinct prefixed values, so no cross-university collision.
- Dual-write is NOT introduced yet. Cutover requires: (a) backfill student_id from profiles.nim where unambiguous, (b) unique index per university, (c) drop global index only after zero cross-university collisions (see `scripts/reconcile-nim-dry-run.mjs`).

### 6. Class-media visibility

- Legacy: class members + public repo entries. No per-subject isolation yet (Option 1 in subject-enrollment doc).
- Full per-subject isolation (Option 2) is deferred until WIP subject-enrollment proves stable.

## Consequences

- UNPAM pilot: 1 university active, 1 class linked, 8 offerings, 248 enrollments (2026-11-05 backfill).
- Cost policy (owner, 2026-11-05): free tier only. No paid Supabase branches. Staging = local stack (`supabase start`).
- Other universities remain `registered` until mapping approved.
