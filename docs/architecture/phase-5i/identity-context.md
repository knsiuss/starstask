# 5I-A — Identity Context

**Status: COMPLETE** (server-side context; no schema change; Google OAuth PKCE untouched)

## What shipped

| File                                                          | Role                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/lib/identity/derive-identity-context.ts`        | Pure decision table (no I/O) — unit-tested                  |
| `apps/web/src/lib/identity/get-identity-context.ts`           | Request-scoped resolver (React `cache()`), server-only      |
| `apps/web/src/components/dashboard/academic-context-card.tsx` | Failure-isolated dashboard strip (renders nothing on error) |
| `apps/web/tests/unit/identity-context.test.ts`                | 12 decision-table tests                                     |

## Decision table implemented

| Situation                                                                          | `IdentityContext.status`          | Behavior                                                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| No profile row                                                                     | `missing_profile`                 | UI routes to onboarding; academic data never loads                                                         |
| No membership rows                                                                 | `no_membership`                   | `/university` shows eligible universities + guidance; nothing is created                                   |
| Membership(s) exist, none active (pending/suspended/graduated)                     | `no_active_membership`            | `/university` explains operator action required (incl. graduated→active reactivation is platform-only, #9) |
| Two or more active memberships                                                     | `multiple_active_memberships`     | **Never picks one**; UI lists personas and asks for operator resolution                                    |
| One active membership, university row unreadable under RLS or `status <> 'active'` | `inactive_university`             | Academic data hidden; contact operator notice                                                              |
| One active membership + university active                                          | `active`                          | Loads identity (`student_identities`) if present; `identity: null` → "not provisioned" note                |
| Active membership but identity absent                                              | `active` + `identity: null`       | **Missing identity** surfaced, never auto-created                                                          |
| Suspended membership                                                               | covered by `no_active_membership` | Suspended personas are listed with their status                                                            |

## Security properties

- Reads go only through the request-scoped cookie client; RLS governs row visibility (`university_memberships_owner_read`, `universities_active_read`, `student_identities_owner_read`).
- No writes of any kind in this module; no RPC calls that mutate.
- Multi-membership never resolves arbitrarily; the app surfaces the ambiguity instead of guessing (decision #7/#8 respected).
- `auth.getUser()` verified server-side via `getSessionUser()`; client-supplied identity is never trusted.
- PKCE flow untouched: `auth/callback`, `proxy.ts`, and `lib/supabase/*` are unmodified in behavior.

## Not implemented / out of scope

- No membership auto-creation, no backfill, no activation (blocked on decision #7).
- No dual-write of legacy `profiles.university`/`nim` (contract phase, later).
- Inactive/suspended universities remain unreadable by design (RLS `status = 'active'` only); the app cannot and does not fetch them.

## Consumption points

- `/university` page (membership state, identity card, home class, enrollments).
- Dashboard `AcademicContextCard` (linked/unlinked line + link to `/university`).
- All new academic admin pages call `resolveClassMemberForPage` / `resolveClassPermissionForPage`, which are orthogonal to this module (class RBAC ≠ university tenancy).
