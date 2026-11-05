# Phase 5A — Decision Register

> **Status:** All Phase 4C ADR statuses below are quoted exactly as recorded in
> `phase-4c/34-architecture-decision-records.md`. **No PROPOSED decision was
> converted to APPROVED in Phase 5A.** Where Phase 5A proceeded on a PROPOSED
> basis, the scope was restricted to additive, reversible SQL (the exact scope
> the Phase 5A brief authorizes), and production activation/backfill remains
> gated on the named approval.

## Decisions table

### D-01 — Single-table `universities` vs separate tenant table

- **Decision:** One `public.universities` table with a `status` lifecycle column
  (`registered → pending → active → suspended → inactive`), per the CONFIRMED
  lifecycle (Phase 4C `08`).
- **Current evidence:** No tenant table exists today (`profiles.university`
  free text only — VERIFIED in `evidence-closure.md` §1). The lifecycle values
  are CONFIRMED by the brief, not by repo evidence.
- **Recommended option:** Single table (ADR-002). A separate tenant table adds
  joins on every tenant-scoped query for one benefit (independent lifecycle)
  already expressible as a status.
- **Alternatives:** (a) Separate `tenants` table with its own lifecycle —
  rejected (operational cost, no scale need); (b) statuses in application
  code — rejected (RLS cannot read app config).
- **Consequences:** Tenant root is one table; suspended/inactive rows can be
  hidden from reads via the existing `status` column without extra joins.
- **Status: PROPOSED** (ADR-002, owner sign-off pending). Phase 5A built the
  table as additive SQL only. **Approval needed before:** any production insert,
  any tenant enforcement in RLS of other tables, any UI for creation/activation.

### D-02 — University lifecycle fields and statuses

- **Decision:** `status` CHECK over exactly the CONFIRMED five values;
  `activated_at`/`deactivated_at` timestamps, no separate state-history table.
- **Evidence:** Lifecycle is CONFIRMED in Phase 4C `08` (state diagram).
- **Alternatives:** Separate `university_status_events` history table —
  deferred; `audit_logs` already exists for platform actions (REPORTED).
- **Consequences:** Current state is always derivable; history relies on
  `audit_logs` once platform-adm
...[truncated 2700 chars]