# Acceptance Criteria

- Phase 1: dashboard/action-center TTFB p95 ≤800ms on seeded large class in dev; zero aggregate drift vs. pre-change snapshot.
- Phase 2: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 in Lighthouse CI must pass on target pages.
- Phase 3: top-5 query duration down ≥30% (before/after `pg_stat_statements`); no RLS policy weakened (policy diff reviewed).
- Phase 4: XLSX export p95 ≤5s via background job; R2 signed upload/download round-trip in staging; orphan report = 0.
- Phase 5–6: tenant isolation test matrix (§TENANT_ISOLATION_SECURITY) all green; single-university drift check passes.
- Phase 7: k6 report for 100/500/1k/5k filed with p95 + error rate + DB metrics.

Related: README.md · PRIORITY_MATRIX.md
