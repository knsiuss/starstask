# Naming Conventions — New vs Legacy (Phase 4C §26-A standard)

**Date:** 2026-11-05 · **Status:** documents the inconsistency; specifies naming for NEW columns/tables only. **No existing column is renamed.**

## Reference standard (Phase 4C §26 header)

From `docs/architecture/phase-4c/26-target-database-schema.md`:

> Naming: `snake_case`; `id uuid PK DEFAULT gen_random_uuid()`; junction composite PKs; `created_at/updated_at timestamptz NOT NULL DEFAULT now()` + `set_updated_at()` trigger; `status text CHECK (...)`; **FK suffix `_id`**; tenant column always `university_id uuid NOT NULL` unless GLOBAL.

Tenant classes: GLOBAL / TENANT_OWNED / TENANT_DERIVED / CROSS_TENANT_REFERENCE / PLATFORM_CONTROLLED.

## The inconsistency (evidence from migrations)

| Column name | Table(s) | Referent | Evidence |
|---|---|---|---|
| `user_id` | `assignments`, `class_members`, `class_admins`, `university_memberships`, `announcement_reads` | `auth.users(id)` | 20261029 core schema |
| `created_by` | `classes`, `class_applications`, `class_invitations` | `auth.users(id)` | 20261029000900 |
| `author` | `announcements.author` | `profiles(id)` | 20261116000000 |
| `organizer_id` | `discussion_sessions.organizer_id` | `auth.users(id)` | 20261029001600 |
| `actor_id` | `audit_logs.actor_id` | `auth.users(id)` | 20261029001100 |
| `applicant_id` | `class_applications.applicant_id` | `auth.users(id)` | 20261029000900 |
| `student_id` | `university_memberships.student_id`, `student_identities.student_id` | **NIM text, not a FK** | 20261111/20261112 |
| `student_identity_id` | `class_memberships`, `class_admin_assignments`, `enrollments` | `student_identities(id)` | 20261114/20261113 |

One referent (`auth.users`) is spelled 5 ways (`user_id`, `created_by`, `author`, `organizer_id`, `actor_id`, `applicant_id`). Two different things (`auth.users` vs `student_identities`) both start with `student_`, and `student_id` is a NIM string — not an id of anything. Renaming any of these is **a breaking cutover, not a cleanup**, and is out of scope for this pass.

## Rules for NEW tables/columns (to be applied at table creation)

1. **FK to `auth.users`** → name it `user_id` (the most common legacy spelling, and the one Phase 4c uses). Only use `actor_id` when the row is an audit/history record and the actor may be null & history survives (document why in the column comment).
2. **FK to `profiles(id)`** → `user_id` is acceptable iff `profiles.id` everywhere means `auth.users.id` (1:1); prefer the referent's own "id" semantics and document it. Never `author`/`created_by` for new rows — both imply authorship/creation, not a generic FK.
3. **FK to `student_identities`** → `student_identity_id` (as in 20261114). Never `student_id` for a FK.
4. **Student number (NIM)** → use `student_id` (text) only within `university_memberships`/`student_identities`, where the table comment defines the referent; global-account NIMs must not be copied into per-university columns without the #7 decision.
5. **Self-FK / parent FK** → `<parent>_id` (e.g. `parent_id`, `academic_unit_id`).
6. **Every FK column** gets a column comment stating referent table + delete rule (CASCADE/RESTRICT/SET NULL) at creation time.
7. **New actor columns**: if the actor is required for accountability, make it NOT NULL; if history must survive account deletion, mirror the `audit_logs.actor_id` SET NULL pattern and say so.

## What NOT to do

- Do not rename `organizer_id`/`actor_id`/`applicant_id`/`created_by` in place. Aliases through views are permitted; column renames require a cutover ADR.
- Do not introduce a 7th spelling for `auth.users`. If a new table needs an actor and none of the above fit, use `user_id` and explain.
- Do not reuse `student_id` for anything other than the NIM string.

## Verification

Naming review is a PR checklist item for new migrations: every new FK column must have (a) §26-A spelling, (b) a comment naming the referent. This doc does not add a linter; enforcement is human review against the decision register.
