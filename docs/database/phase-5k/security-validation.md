# Security validation — Phase 5K

> **Date:** 2026-11-05. **Scope:** `session_checkin_summary_many` + converted call sites. **Production access: NOT USED.**

## 1. What was proven (staging scratch DB only)

**Fixture:** synthetic user `00000000-0000-4000-8000-000000000001`, synthetic class/course with 120 synthetic sessions. No real student or class data was involved.

| Test | Result | Script |
| --- | --- | --- |
| Row equivalence (old vs new RPC) | **PASS** — 120 = 120, 0 mismatch | `supabase/tests/phase5k-session-checkin-summary-many-validation.sql` |
| Duplicate UUID handling | **PASS** — 2 distinct UUIDs (one repeated) return **2** rows | same |
| Invalid UUID | **PASS** — returns **0** rows, no error | same |
| Cross-class / non-member | **PASS** — **0 rows** for `sub` = random synthetic UUID (`...0099`) with a known session ID | same |
| Anonymous caller | **PASS** — **0 rows** when `sub` is cleared | same |
| Anon EXECUTE grant | **PASS** — `information_schema.role_routine_grants` reports **0** grants to `anon` | same |

## 2. Security properties preserved

- Function is `SECURITY DEFINER` with `search_path = ''` — schema-qualified references only.
- Authorization is via `can_view_session(p_session_id)`, the same helper the single-session RPC uses. Tenant scoping is inherited (the existing helper already checks `is_platform_admin` + `is_class_member`; Phase 5A–5G adds `university_id` columns on classes but the session-level check does not compare tenant directly — same as before).
- Raw coordinates are never returned: function returns only `(session_id, has_location, radius_m)`.
- `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`; `GRANT EXECUTE TO authenticated` only.
- Application no longer makes N RPCs from browser context; that reduces attack surface (one round-trip, one grant, fewer parameters to tamper with).
- NULL/empty array input returns nothing. Array length capped by list pages (max 50 candidates).

## 3. What was *not* proven

- Live DB negative tests against a second synthetic university run by the application harness (the SQL stub above covers RPC only, not RLS on Storage buckets or PostgREST direct table access).
- CSP nonce blocking of inline theme script (`THEME_BOOT_SCRIPT`). This is a **known, deliberately un-fixed** product decision (per the phase-5k review prompt, deferred to a later CSP phase). It is not introduced by Phase 5K and blocks dark theme on fresh loads.

## 4. Pre-existing risks carried forward (not introduced)

| Risk | Reference |
| --- | --- |
| `class-media` bucket public without restriction | Phase 4B report; Phase 5K did not touch it |
| Legacy `SEARCH_PATH` in 131 functions | Phase 4B security definer review |
| `complete_leave_forwarding` PUBLIC grant | Phase 4B recommendation |
| FORCE RLS not used on 52 tables | Phase 4A |

None were weakened or made worse by Phase 5K.

## 5. Parity statement

- No production table, policy, or function was modified by Phase 5K.
- Test DB (`starstask_phase5k_20261105`) contained synthetic data only and must not be treated as production evidence.
