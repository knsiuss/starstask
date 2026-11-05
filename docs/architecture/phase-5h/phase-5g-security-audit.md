# Phase 5H — 5G Security Audit

Mode: static inspection + targeted negative-test review. **No live database execution.**
All tables new in 5A–5G were RLS-enabled and had `REVOKE ALL ... FROM anon` (verified by reading migration bodies), with SELECT granted to authenticated and no write policies. Therefore PostgREST cannot perform inserts/updates/deletes for those tables as `authenticated`.

## Tenant isolation

- Composite "same-university" FKs present wherever a child references a parent across domains (`semesters→academic_years`, `class_memberships→classes/identities`, `announcements→classes/offerings`, `attendance_records→meetings`, `enrollments→offerings`, etc.). VERIFIED.
- Direct `university_id` on every tenant-owned table. No `SET NULL` on tenant FKs (tenants cannot be detached from owned data). VERIFIED.
- Inherited tenant context exists only via parenting — no table relies on RLS alone for a relationship that crosses universities. VERIFIED.
- Tenant-scoped uniqueness: `(university_id, lower(btrim(code)))` style indexes; one-current-year; one-home-class partial uniques. VERIFIED.
- Cross-university **write** attempts by an `authenticated` client are impossible for new tables (no write grant), and impossible cross-tenant for platform tools unless RPC/service_role is used. VERIFIED statically.

## RLS policies reviewed (new/affected)

| Resource                | SELECT readers                      | Writes                                                   | Assessment              |
| ----------------------- | ----------------------------------- | -------------------------------------------------------- | ----------------------- |
| universities            | authenticated, active only          | none from clients                                        | VERIFIED                |
| university_memberships  | owner only                          | none from clients                                        | VERIFIED                |
| academic_units          | university members / platform admin | none from clients                                        | VERIFIED                |
| student_identities      | own rows / platform admin           | none from clients                                        | VERIFIED                |
| class_memberships       | university member+admin             | none from clients                                        | VERIFIED                |
| course_invite_tokens    | university members (read)           | none from clients — **tokens not redeemable via client** | BLOCKED for product use |
| class_admin_assignments | university members / platform admin | none from clients                                        | VERIFIED                |
| attendance_*            | university scoped member reads      | none from clients                                        | VERIFIED                |
| grade_*                 | university scoped member reads      | none from clients                                        | VERIFIED                |
| announcements / reads   | class/platform members              | none from clients                                        | VERIFIED                |

## SECURITY DEFINER review

- **New:** `has_class_permission` — `search_path=''`, `STABLE`, REVOKE/GRANT verified; queries own assignment rows only; returns boolean; no data leakage beyond boolean. VERIFIED.
- **New:** `guard_last_class_admin` — `search_path=''`; trigger-only revoke guard; does not grant privileges. VERIFIED.
- **5B:** `platform_upsert_student_identity` — `search_path=''`, `is_platform_admin()` gate, same-university validation, `record_audit` call. VERIFIED on disk.
- **Legacy:** dozens of pre-existing definers rely on default search_path or per-policy short-circuits; not rewritten in 5B–5G; risk flagged but outside this audit's scope (and out of allowed changes).
- No new definer exposes `service_role` to the browser; none write to `universities` activation fields; no definer can grant membership without platform-admin check.

## Anonymous access

- All new tables: `REVOKE ALL ... FROM anon`; no policies for anon. VERIFIED.
- Storage buckets: `leave-evidence`, `verification-evidence`, `assignment-attachments` private; `avatars`, `class-media` public (intent open question). No public bucket was switched to public by phases 5A–5G.

## Audit logs

- Captures actor + action + entity + `{}` metadata via RPC paths; **5G adds** `university_id`, `before_state`, `after_state` (jsonb object constraints only).
- **Not verified:** write denial for `audit_logs` (INSERT grants to authenticated were not enumerated in this audit; app code does not write directly); tamper-proofing beyond object type check (no immutability trigger); university_id `BEFORE INSERT` enforcement (university_id can be NULL).

## Findings that matter for 5I

1. **Invitation flow is unusable by design.** Tokens exist, but there is no redemption RPC exposed to users and no usage-policy default. Any "accept link" feature must wait for the usage decision.
2. **Announcements/discussion tables are read-only from clients.** Publishing requires RPC/service path that does not exist yet — application integration is 0.
3. **`audit_logs.university_id` is nullable.** A misrouted RPC could record platform actions with no tenant scope; add a consistency trigger/NOT NULL **after** backfill plan is approved (5I decision, not auto-fixed).
4. **Legacy RLS predicates** (`is_class_member` etc.) remain on PHP/SQL land and are not covered by 5G tests; expect hot-path overhead ~documented in performance review.
5. **No storage policy was touched.** If tenant isolation for new files is needed, it must be designed, not assumed.
