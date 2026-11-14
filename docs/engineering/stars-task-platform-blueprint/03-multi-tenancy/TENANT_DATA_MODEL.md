# Tenant Data Model

Proposed entities (label: **proposed**, not yet in schema — do not treat as existing):

| Entity                                | Role                                            | Ownership                       |
| ------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `universities` (proposed)             | Tenant root                                     | —                               |
| `university_memberships` (proposed)   | user ↔ university + role                        | ties `auth.users` to university |
| `university_settings` (proposed)      | per-uni flags (calendar domain, semester rules) | scoped to university            |
| `university_roles` (proposed)         | platform-admin scoped to university             | scoped                          |
| `university_domains` (proposed)       | invite/email domains for auto-membership        | scoped                          |
| `university_subscriptions` (proposed) | billing tier per university                     | scoped (future)                 |

Existing-scoped candidates (must carry `university_id`): `classes`, `class_members`, `class_subjects`/`subjects`, `class_course_schedules`, `assignments`, `assignment_submissions`, `discussion_sessions`, `discussion_session_checkins`, `attendance_verification_attempts`, `leave_requests`, `leave_request_*`, `notifications` (via user+university), `materials`, `announcements`, `audit_logs`, `push_subscriptions`.
Global candidates: `auth.users`, `profiles`, platform-admin scope table.

Constraints (Phase 6): `UNIQUE(university_id, slug)` on classes; `UNIQUE(user_id, university_id, class_id)` on members; composite FKs `(university_id, class_id)` on child tables; indexes lead with `(university_id, ...)`.

Migration sketch (Phase 6, not executed): add `university_id` nullable → backfill single university → backfill rows → make NOT NULL + add constraints + index sweep → tenant-aware RLS.

Related: README.md · AUDIT: DATABASE_RLS_AUDIT.md
