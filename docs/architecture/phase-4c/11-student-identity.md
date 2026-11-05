# 11 — Domain E: Student Identity (Per-University)

> **Status:** DRAFT. **CONFIRMED** = brief decision; VERIFIED = repo evidence.

## 11.1 University membership / profile

- **CONFIRMED:** per-university independent membership, student ID, profile, roles, permissions.
- **VERIFIED today:** no membership row exists; the only academic attributes are `profiles.nim text` (CHECK format `^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$`, `20261029002700_profile_onboarding.sql`), `profiles.university text` (CHECK length 2–120, same file), and `20261029003110_profile_nim_unique.sql` (REPORTED global unique — multi-tenant risk).
- **RECOMMENDED:** membership = one `student_identities` row per `(user_id, university_id)`. No separate "university member" table needed — the identity row IS the membership.

## 11.2 Student profile as extension vs separate (RECOMMENDED)

**RECOMMENDED: separate `student_identities` table extending `profiles` 1:N** (one global `profiles` → many per-university `student_identities`).

| Option                                         | Verdict                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Extend `profiles` (add `university_id` column) | Rejected: breaks 1:1 `auth.users ↔ profiles` trigger model; cannot hold two NIMs for one user. |
| Separate table (RECOMMENDED)                   | Preserves global identity; per-university rows carry NIM/entry_year/program/status.            |

- Columns (target): `id uuid PK`, `user_id uuid NOT NULL → profiles`, `university_id uuid NOT NULL → universities`, `student_id_number text NOT NULL`, `entry_year int NOT NULL`, `full_name_snapshot text NOT NULL`, `unit_id uuid NULL → academic_units`, `status pending/active/suspended/graduated`, `verified_by uuid NULL`, `verified_at timestamptz NULL`, `created_at`, `updated_at`.
- UNIQUE `(university_id, student_id_number)` (RECOMMENDED per-tenant — fixes the global-NIM collision: same NIM string at two universities for different people).

## 11.3 Multi-university students

- **CONFIRMED:** one global account; independent per-university membership. A single user may hold `student_identities` rows at University X and University Y simultaneously, each with its own NIM, entry year, and status.
- No cross-university identity linkage is exposed to other users (privacy: RLS is tenant-scoped; see `23`).
- Switching context = switching the `student_identities` row the session resolves (server-derived, never client-supplied).

## 11.4 Different IDs / statuses per university

- IDs differ because `student_id_number` is an opaque per-university string (NIM format is NOT enforced per university — existing CHECK is deliberately generic, VERIFIED comment: "A conservative format check, not a university-specific rule").
- Statuses are per row: e.g. `active` at X, `suspended` at Y simultaneously (RECOMMENDED lifecycle above).
- **UNRESOLVED (new):** whether a user with `pending` identity at a university may view that university's catalogue before verification — RECOMMENDED: catalogue read allowed, enrollment blocked until `active`. Needs owner sign-off.

## 11.5 Leaving / graduating / returning / changing programs

| Transition       | RECOMMENDED handling                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leave (withdraw) | `status → suspended` (or new `withdrawn` value — UNRESOLVED) with `left_at`; membership rows retained for history; enrollments remain for transcript queries. |
| Graduate         | `status → graduated` + `graduated_at`; read-only; enrollments kept.                                                                                           |
| Return           | `suspended → active` reactivation RPC; same `id` retained (identity is stable).                                                                               |
| Change programs  | `unit_id` update via admin RPC + audit; Entry Year unchanged (CONFIRMED fixed cohort).                                                                        |

- **UNRESOLVED (new):** whether `graduated` may later become `active` (alumni re-enrollment) or requires a new identity row. RECOMMENDED: reactivate same row (stable identity) unless audit requires new row — needs owner decision.
- Profile deletion: NEVER hard-delete `student_identities` while `enrollments`/`attendance_records`/`grade_entries` reference them; prefer status transitions. Cascade only on global `auth.users` deletion (existing VERIFIED pattern).

## 11.6 Onboarding wiring (VERIFIED anchor)

- Current onboarding collects `full_name`, `nickname`, `nim`, `university`, `declared_class_name` and sets `onboarded_at` only after validation (`20261029002700`, `update_my_profile()`).
- Target: onboarding writes global fields to `profiles` and creates the first `student_identities` row (university resolved from registry, not free text — fuzzy free-text mapping is UNRESOLVED, see `30`).

**Cross-refs:** `07` (§7.2/7.6), `08` (registry), `10` (entry year vs period), `12` (membership), `13` (enrollments), `23` (§23.2/23.3), `26` §26.1, ADR-001/004, `36` items 7/9.
