# Phase 5D — Decision Register

- D-01 class_memberships bridges identities to home class (one active home per identity, partial unique); legacy class_members untouched. Retakes are enrollments (5C), never membership changes.
- D-02 course invites: hash-only (64-char), expiry/revocation/use-count/audit columns; usage policy UNRESOLVED → no defaults, explicit max_uses/expires_at required at creation (STOP on policy, documented, rest continued).
- D-03 RBAC normalized: class_admin_assignments (identity or user) + class_admin_permissions (8 codes); presets = permission bundles via data, groups deferred; last-admin trigger; cross-class denial inherent in row-scoped policies.
