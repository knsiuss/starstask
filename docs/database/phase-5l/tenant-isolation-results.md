# Phase 5L — Tenant Isolation Results

Test: `supabase/tests/phase5l-tenant-isolation-validation.sql`
(disposable local DB, synthetic University A/B, 7 synthetic users).
Results observed 2026-11-05:

| Test | Expected | Actual | Verdict |
|---|---|---|---|
| T1 A-student reads A `academic_years` | 1 row | 1 | PASS |
| T2 A-student reads B | 0 rows | 0 | PASS |
| T3 A-student INSERT into B | blocked | blocked (`permission denied for table academic_years`) | PASS |
| T4 Non-member reads A | 0 rows | 0 | PASS |
| T5 Suspended member reads A | 0 rows | 0 | PASS |
| T6 Graduated member reads A | 0 rows | 0 | PASS |
| T7 Dual-membership reads A+B | 2 rows | 2 | PASS |
| T8 UPDATE `university_id` A→B | 0 rows changed | blocked (`permission denied`), 0 changed | PASS |
| T9 Anon reads A | 0 rows | blocked (`permission denied for table`) | PASS |

Notes:
- T3/T8 deny at the table-privilege layer (Phase-5 tables grant SELECT
  only to `authenticated`), before RLS is even evaluated. Defense in depth.
- T5/T6 confirm `is_university_member` requires `status='active'`;
  suspended and graduated members are denied.
- T7 confirms multiple memberships work per-tenant (each membership
  evaluated independently).
- T8 confirms `university_id` cannot be moved through UPDATE
  (no write grant + no update policy).
- No cross-university data was exposed in any test; unauthorized
  operations changed nothing (verified by follow-up counts).
