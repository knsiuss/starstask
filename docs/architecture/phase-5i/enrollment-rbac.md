# 5I-D — Enrollment & Class RBAC

**Status: PARTIALLY** (RBAC administration + safe invite read/revoke ship; enrollment flows stay blocked on policy decisions)

## What shipped

| File                                                                          | Role                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/lib/authz/class-permission.ts`                                  | Central RBAC: `hasClassPermission`, `authorizeClassPermission`, `requireClassPermission` (routes), `resolveClassPermissionForPage` (pages), `resolveClassMemberForPage`, `hasAnyClassPermission` |
| `apps/web/src/lib/authz/service-role.ts`                                      | `requireServiceRoleClient()` — 503 when unconfigured; never ships the key to the client                                                                                                          |
| `apps/web/src/lib/db/class-admins.ts`                                         | RLS reads: assignments + permissions + names                                                                                                                                                     |
| `apps/web/src/lib/db/class-admins-service.ts`                                 | Service-role grant/revoke with tenant re-validation, composite-FK enforcement, last-admin mapping, audit                                                                                         |
| `apps/web/src/app/api/classes/[slug]/academic/admins/route.ts`                | `POST` grant — gated `manage_admins`                                                                                                                                                             |
| `apps/web/src/app/api/classes/[slug]/academic/admins/[assignmentId]/route.ts` | `DELETE` revoke — gated `manage_admins`; 409 on last admin                                                                                                                                       |
| `academic/admins/page.tsx`                                                    | Admin console for the class (list/grant/revoke)                                                                                                                                                  |
| `apps/web/src/app/(console)/admin/invitations/page.tsx`                       | Platform-admin invite registry (read-only) + revoke                                                                                                                                              |
| `apps/web/src/lib/db/course-invites.ts`                                       | List (no hash ever selected) + revoke (service-role, platform-admin via route guard)                                                                                                             |
| `apps/web/src/lib/db/course-offerings.ts`                                     | Home membership + my enrollments + open offerings (read-only)                                                                                                                                    |
| `/university` page                                                            | Home class display (no change path), enrollments, offering discovery                                                                                                                             |

## Requirements audit

- **Home class display:** shipped on `/university`; one active home per identity (DB partial unique index). **No home-change flow exists** and none was built.
- **Offering discovery "where rules verified":** read-only listing of `open` offerings for the caller's active university (RLS-checked). Enrollment rules are NOT verified (no policy published), so **discovery grants nothing** — enrollment remains admin/invite-driven, and no self-enroll button exists.
- **Retake isolation:** enforced by schema design (enrollments reference offerings; `source='retake'`; unique active per offering+identity; home class untouched). Verified on disk; exercised only at DB level — not wired to any write path because none exists for ordinary users.
- **Class admin dashboard w/ server-verified permission:** shipped. Every page/route verifies `has_class_permission()` server-side on the caller's own session; the platform-admin short-circuit comes from `is_platform_admin()`.
- **Centralized authz helper:** `lib/authz/class-permission.ts` is the single gate for new academic domains; `requireClassPermission` maps failures to 401/403/404/409 without leaking class existence.
- **Multiple admins:** supported (schema allows many assignments per class; UI lists all, active first). **Presets/groups: NOT built** — schema stores raw permission codes only; no preset table exists; groups remain a documented future gate (decision D-5I-7).
- **`manage_admins` gating:** grant/revoke + the admins page itself require it (or platform admin).
- **Last-admin defense:** DB `guard_last_class_admin` trigger + app-level mapping to `409 last_admin` with actionable message; UI states the rule.
- **Course invitations:** policy (#5) unresolved → **only safe read/admin mgmt shipped**: platform-admin list (never the hash) + revoke (invalidates only). **No create, no accept, no redemption.** Revoking is allowed because it cannot fabricate policy.

## Deliberately not built

- Accept/create invitation flows; max-uses/expiry defaults; single-use semantics (all #5).
- Any "switch home class" or membership request flow (#7/#8).
- Enrollment writes of any kind for ordinary users (no verified policy).
- Class admin delegation for legacy classes (composite FK requires linked university).

## Negative paths (unit level)

Identity decision table (12 tests), schema bounds for grant payloads, tenant-unlinked → 409 for all write routes. **No live cross-university negative test was run** (no DB started this phase); see test-validation-report.md.
