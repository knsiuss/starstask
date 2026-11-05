# 15 — Domain I: Class Administration RBAC

> **Status:** DRAFT. **CONFIRMED** = brief decision; VERIFIED = repo evidence.

## 15.1 What exists today (VERIFIED — `20261029000900_classes.sql`)

```sql
class_admins(
  class_id uuid NOT NULL,
  user_id  uuid NOT NULL,
  assigned_by uuid → auth.users SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PK (class_id, user_id),
  FK (class_id, user_id) → class_members (ON DELETE CASCADE)
)
```

- **Admin is always a member:** FK `(class_id, user_id) → class_members` with `ON DELETE CASCADE` — removing membership removes admin in the same statement (VERIFIED comment in DDL: "the two tables cannot drift apart").
- **No permission columns exist** in current `class_admins` (columns are exactly `class_id`, `user_id`, `assigned_by`, `assigned_at`). Granular `manage_*` permissions are **net-new** (see §15.4).
- Delegation migration: `20261102101000_class_admin_delegation.sql` (VERIFIED present; full contents REPORTED — Phase 5A to read).
- **Assign/revoke entry points (VERIFIED):**
  - `assign_class_admin(p_class_id, p_user_id)` — **platform-admin-only** (`is_platform_admin()` else 42501); inserts member + admin rows; calls `record_audit('class_admin_assigned')` + notification enqueue.
  - `revoke_class_admin(p_class_id, p_user_id)` — platform-admin-only; contains a last-admin guard (`count(*) <= 1` check observed in DDL).
  - Predicates: `is_class_admin(p_class_id)` = EXISTS on `class_admins`; `can_manage_class(p_class_id)` = `is_platform_admin() OR is_class_admin()` (`20261029001100_class_functions.sql`), all STABLE SECURITY DEFINER with `search_path = ''` (see `24` §24.3).

## 15.2 RBAC vs permission vs hybrid (RECOMMENDED: hybrid)

| Model                                                                                              | Verdict                                                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Pure RBAC (fixed "admin" role)                                                                     | Rejected: CONFIRMED requires differing permissions (manage_attendance vs manage_grades…). |
| Pure permission (free-form flags per user)                                                         | Rejected: no role semantics; "manage_admins can delegate" becomes unexpressible.          |
| **Hybrid (RECOMMENDED):** role = `class_admin` (membership), permissions = named `manage_*` grants | Chosen: role gates entry, permissions gate actions.                                       |

- Evaluation order (RECOMMENDED): `is_platform_admin()` (platform override) → `is_class_admin()` (role) → `has_permission(class_id, code)` (granular) → action.
- Every check is a `(class_id, user)` pair — no global admin flag (CONFIRMED no cross-class spillover).

## 15.3 Permission scopes

| Scope             | Examples                                                                                                                                                          | Notes                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GLOBAL            | `is_platform_admin()`                                                                                                                                             | Platform-wide; can moderate any class (existing `can_manage_class`).                                                            |
| UNIVERSITY        | (none confirmed)                                                                                                                                                  | **UNRESOLVED (new):** no university-level admin role exists. RECOMMENDED: do not create until needed; platform admin covers it. |
| CLASS (CONFIRMED) | `manage_attendance`, `manage_assignments`, `manage_announcements`, `manage_grades`, `manage_admins`, `manage_schedule`, `manage_materials`, `manage_leave_review` | Class-scoped; covers **all** class courses (CONFIRMED). Per-offering admin override: NOT confirmed (PROPOSED: excluded).        |

## 15.4 Target schema (RECOMMENDED; full spec in `26`)

- `class_admin_assignments(id, class_id, university_id, student_identity_id, granted_by, granted_at, revoked_at, revoked_by)` — replaces `class_admins` direct `user_id` with `student_identity_id` (per-university persona, see `11`).
- `class_admin_permissions(assignment_id, permission_code CHECK (...))` — normalized rows (one per grant).
- **manage_admins (CONFIRMED):** only holders of `manage_admins` (or platform admins) may grant/revoke admin assignments or permissions. Existing `assign/revoke_class_admin` RPCs are currently platform-admin-only (VERIFIED) — target moves them behind `manage_admins` per CONFIRMED brief (expand-contract: dual-gate both during migration).

## 15.5 Last-admin safeguard (CONFIRMED + VERIFIED partly)

- CONFIRMED: last-admin protection.
- VERIFIED: `revoke_class_admin` already guards `count(*) <= 1` (last admin cannot be revoked by that path). **Gap (UNRESOLVED new):** whether the guard covers all revocation paths (member removal cascade, expiry) or only the RPC — Phase 5A to audit.
- RECOMMENDED: DB-level BEFORE-UPDATE/DELETE trigger counting active `manage_admins` holders (see `27`) as defense-in-depth behind the RPC guard.

## 15.6 Self-assignment, revocation, cross-class/university prevention

| Rule             | Handling                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-assignment  | Blocked unless actor holds `manage_admins` (or platform admin); an admin cannot grant themselves more permissions (RECOMMENDED).                                                              |
| Revocation       | Sets `revoked_at`/`revoked_by` + audit; membership retained (role removal ≠ membership removal). Member removal cascades admin (VERIFIED existing behavior — preserve in target via trigger). |
| Cross-class      | Every predicate takes `p_class_id`; no query joins two classes without explicit separation (CONFIRMED).                                                                                       |
| Cross-university | `university_id` on assignments + composite FK to `classes(id, university_id)` (see `23` §23.2); tenant-guard added to `is_class_member()` (see `24` §24.3).                                   |

## 15.7 Lecturer roles

- NOT confirmed (extensible only) — no lecturer tables exist (VERIFIED ABSENT). Future `lecturer_assignments` must not reuse `class_admin_*` tables (UNRESOLVED, `36`).

**Cross-refs:** `06`, `11`, `12`, `13`, `14`, `23`, `24` (§24.3), `26` §26.1, ADR-008, `36` items 4/12.
