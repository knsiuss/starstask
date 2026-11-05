# Authentication & Authorization

## Identity (existing, verified)

- Supabase Auth: email/password + Google provider path in UI; `@supabase/ssr` cookie session; server resolution via `getSessionUser()` in `(workspace)/layout.tsx`.
- Profile provisioning: `profile_onboarding` flow (`onboarding`, `/api/profile/onboarding`, `docs/PROFILE_ONBOARDING.md`).

## Authorization (existing, verified pattern)

- Class-scoped roles: `isMember`, `isAdmin`, `canManage`, `isPlatformAdmin` via `getClassRole()`; RPCs `can_manage_class`, `review_class_assignment`, `review_leave_request` (self-review blocked), `record_audit`, attendance corrections.
- Platform admin console under `(console)/admin/**`; developer console under `(console)/developer/**`.

## Future tenant layer (proposed, Phase 5)

1. Global Auth identity → `university_memberships` lookup → active-university resolution (server session claim).
2. University-specific permissions layered under class permissions; never assume global role.
3. RLS: `university_id = current_university_id()` + existing class predicates.
4. Unauthorized: redirect to login/university picker with `next` param preserved (existing `buildLoginPath` pattern).

Diagram: diagrams/05-authentication-authorization.mmd

Related: README.md · TENANT_ISOLATION_SECURITY.md
