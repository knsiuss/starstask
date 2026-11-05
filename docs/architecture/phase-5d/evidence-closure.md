# Phase 5D — Evidence Closure

Legacy class_members (class_id,user_id PK, joined_via invitation/admin_assignment/platform_assignment) + class_admins (subset of members, last-admin guard in revoke_class_admin) + class_invitations (SHA-256 hash, 1–500 uses) verified. No identity-linked membership existed; 5B identity per membership (student_identities) verified. RBAC permission codes from 26-I (8 codes) — none existed as a table. Invite usage default (10/30d) is RECOMMENDED only (36#8), not approved in 5B register → not invented.
