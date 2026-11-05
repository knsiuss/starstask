# 24 — RLS & Function Security Review

> **Status:** DRAFT. **Counts:** 143 functions in generated types (VERIFIED); 208 `security definer` text occurrences (VERIFIED count); 115 `create policy` text occurrences (VERIFIED count; distinct policies ≈83 REPORTED).

## 24.1 Authorization hierarchy (VERIFIED pattern)

1. Supabase Auth (`auth.uid()`) → `profiles` 1:1.
2. `is_platform_admin()` → platform-wide (mod/admin queries, class application decisions).
3. `is_class_member()` / `is_class_admin()` → class-scoped (member read, admin write).
4. `can_manage_class()` / `can_*` family → permission-gated RPCs.
5. Storage policies → object-level (path + membership).

## 24.2 RLS matrix (per resource × operation — condensed, VERIFIED pattern)

| Resource | SELECT | INSERT | UPDATE | DELETE | Notes |
|----------|--------|--------|--------|--------|-------|
| `profiles` | self | trigger-only (`handle_new_user`) | self (limited cols) | none | NIM/university via `update_my_profile()` |
| `classes` | member or public catalogue rules | RPC-gated | admin | admin/lifecycle | join policy 20261031140000 |
| `class_members` | members see class roster | RPC-gated | admin | admin | no direct client insert |
| `assignments` | class-scoped + public filter | publish privilege | owner/admin | owner/admin | read scope 20261102104000 |
| `discussion_session_checkins` | member | self (check-in RPC) | admin corrections | none | corrections via `attendance_correction_audits` |
| `leave_requests` + evidence | applicant/reviewer | applicant | applicant/reviewer (revision flow) | applicant (cancel) | OCR evidence flow |
| `notification_deliveries/events` | self | internal | claim/complete | none | service-role claim |
| `storage.objects` | bucket policy (path) | authenticated (path) | — | owner | private buckets |

Full per-policy text: `docs/database/architecture/RLS_POLICIES.md` (REPORTED, 64 KB).

## 24.3 `is_class_member()` review (VERIFIED)

```sql
-- supabase/migrations/20261029001100_class_functions.sql:32
CREATE FUNCTION public.is_class_member(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_members m
                 WHERE m.class_id = p_class_id AND m.user_id = (SELECT auth.uid()))
$$;
-- EXECUTE granted to authenticated (line 1360)
```

- **Volatility:** STABLE (correct — same-tx consistent). **search_path:** `''` (correct — hardened). **Recursion:** SECURITY DEFINER is *intentional* (file header comment: policies querying `class_members` directly would recurse) — KEEP.
- **Callers (VERIFIED):** ≥19 migration files (class, session, leave, onboarding, calendar, checkins, posts, lifecycle, attendance, isolation, content, grants) + `apps/web/src/lib/db/classes.ts`.
- **Target change:** `is_class_member(p_class_id)` → `is_class_member(p_university_id, p_class_id)` or class→university FK check inside the definer (RECOMMENDED: add tenant guard without changing call sites' shape — see `26`).
- **Sibling predicates:** `is_platform_admin()`, `is_class_admin()`, `can_manage_class()`, `can_organize_class_sessions()`, `can_publish_public_assignment()` — same pattern (STABLE, definer, `search_path=''`).

## 24.4 SECURITY DEFINER inventory (classification)

208 occurrences across 83 files (VERIFIED count). Generated types expose 143 distinct functions (VERIFIED). Grouped classification:

| Group | Count (approx.) | Verdict |
|-------|----------------|---------|
| Predicates: `is_*`, `can_*` | ~20 | **KEEP** (required for RLS; audit `search_path` + STABLE) |
| State transitions: `create_*`, `accept_*`, `check_in_*`, `create_leave_request`, verification fns | ~60 | **KEEP** (atomic, must stay definer; verify arg validation) |
| Outbox/internal: `claim_*`, `complete_*`, `record_audit`, `enqueue_*` | ~15 | **KEEP** (REVOKE from authenticated where not needed — review grants) |
| Session/attendance lifecycle: open/close/check-in/rosters/summaries | ~30 | **REVIEW** (coordinate triggers, geo data handling, coordinate retention 20261031190000) |
| Monitoring/admin queries | ~15 | **REVIEW** (PII-free variant 20261029003200 VERIFIED as direction; confirm no PII leaks) |
| Re-definitions across migrations (CREATE OR REPLACE chains) | remainder | **REVIEW** (dead versions linger; Phase 5A should squash-verify grant lists) |
| Production-only `rls_auto_enable()` | 1 | **REVIEW** (PUBLIC EXECUTE per Phase 4B — narrow grants or adopt explicit-RLS convention; owner decision) |

Grants: `revoke all` + selective `execute … to authenticated/service_role` pattern observed (VERIFIED example lines 1340–1360). Any function reachable by `anon` needs explicit justification (none clearly identified; Phase 5A to enumerate grants from catalog).

## 24.5 Privilege & storage review

- **Privileges:** RLS enabled on all 52 tables (VERIFIED). Storage: private buckets (VERIFIED `assignment-attachments` public=false). VAPID/OAuth secrets server-only (AGENTS.md §7, VERIFIED pattern).
- **Storage security:** per-bucket path policies VERIFIED for assignments/leave/verification; class-media policy needs Phase 5A confirmation (UNRESOLVED).

> WHY SECURITY DEFINER predicates exist: RLS policies calling them would otherwise query the very tables they protect (infinite recursion). The file header says so explicitly — flipping them to INVOKER breaks auth. Mitigation is narrow EXECUTE grants + `search_path=''`, which the repo already follows.
