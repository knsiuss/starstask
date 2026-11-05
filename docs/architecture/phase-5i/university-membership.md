# 5I-B — University & Membership

**Status: PARTIALLY** (read-only selection ships; registry administration is BLOCKED by design/RLS; nothing activates anything)

## What shipped

| File                                                          | Role                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(workspace)/university/page.tsx`            | University & academic identity page: status card, identity card, home class, enrollments, open-offerings discovery, university browser |
| `apps/web/src/components/university/university-selector.tsx`  | Read-only selector: public details + "how to get access" copy; **no persistence, no switching**                                        |
| `apps/web/src/lib/db/universities.ts`                         | `listActiveUniversities()` — RLS `status = 'active'` only                                                                              |
| `apps/web/src/components/dashboard/academic-context-card.tsx` | Dashboard strip; "not linked yet" CTA                                                                                                  |

## University selection semantics (as shipped)

- **Only `active` universities are shown.** RLS hides `registered` / `pending` / `suspended` / `inactive` rows from every authenticated role including platform admins; 5I does not bypass this and adds no elevated read.
- Selecting a university displays its public profile and the access path ("ask the operator to link your account"). **Selection is not a request and is never persisted.** Self-service switching/requesting is deliberately absent — the registry mapping/activation decision (#7) is unresolved.
- Membership states drive `/university`: any state other than exactly one active membership + active university renders the appropriate notice and no academic data.
- Home class (5I-D cross-ref) shown read-only; enrollments listed read-only; open offerings listed as discovery only.

## Platform Admin sub-feature: BLOCKED

Requested: platform-admin UI for the university registry (list all statuses, activate/deactivate).

**Why it stops here:** the only paths to non-active rows are (a) service_role reads (bypasses RLS) or (b) a new SECURITY DEFINER list/activate RPC (new migration + platform decision). The engagement rules for this phase disallow bypassing RLS and prefer zero migrations; ADR-002 (single-table registry) is explicitly pending platform sign-off, and no ordinary or admin user may activate a university.

**Unblock requires:** platform sign-off for ADR-002 + a reviewed, additive `university_*` definer migration (or acceptance of a documented service_role read path), plus product decisions on #7 (registry mapping). Until then: **registry stays operator-managed out-of-band; no UI ships.**

What the existing admin console _does_ carry now: `/admin/invitations` (safe read/list/revoke of course invite tokens — see enrollment-rbac.md) and the pre-existing platform tools. No university activation surface exists.

## Membership management RPC check (5I-B deliverable)

`platform_upsert_student_identity` was read before designing anything:

`platform_upsert_student_identity(p_membership_id uuid, p_academic_unit_id uuid | null, p_student_id text, p_entry_year int | null, p_status text) returns uuid`
— caller must satisfy `is_platform_admin()`; writes `student_identities` (upsert), mirrors `university_memberships.status`, records an audit row; same-university unit validation; graduated reactivation allowed on the same row. It **cannot** create memberships, grant platform admin, or activate universities. It is intentionally **not** wired to any ordinary-user flow; no UI calls it (the identity bridge remains platform-operator-only).

## Verification notes

- Multi-membership / suspended / inactive / missing-identity handling: see identity-context.md + unit tests.
- RLS coverage for memberships is owner-read only; the UI reflects exactly that.
- No activation, backfill, or membership creation occurred in this phase (verified: zero write call sites added to `university_memberships` / `universities`).
