# Implementation Roadmap

| Phase | Objectives | Key tasks | Acceptance | Risk/rollback |
|---|---|---|---|---|
| 0 Baseline | Measure | Lighthouse CI, k6 baseline, `pg_stat_statements` snapshot, confirm 3-cron mechanism | benchmark sheet filed | none |
| 1 Critical perf | Fix confirmed P0 | RPC dashboard aggregation, fan-out parallelization, pagination caps | TTFB p95 ≤800ms on target routes | perf-only triggers, revertible |
| 2 Frontend | Loading/nav | Suspense streaming, targeted invalidation, bundle budget | LCP ≤2.5s, INP ≤200ms | UX snapshots |
| 3 Backend/DB | Queries | `EXPLAIN ANALYZE`-driven indexes, membership function, lean RPCs | top-query duration down 30%+ | index drop rollback |
| 4 Storage/heavy | R2 + jobs | R2 bytes, DB job queue, export/OCR background | XLSX p95 ≤5s via jobs | dual-read transition |
| 5 Multi-tenant foundation | Tenant context | `universities`, `university_memberships`, middleware context | isolation tests pass | feature toggle per university |
| 6 Migration | Data | §DATA_MIGRATION_STRATEGY steps | zero-row-loss assertions | reverse column drop |
| 7 Reliability | Load/resilience | k6 100→5k, retries, capacity plan | test report filed | opt-in testing |
| 8 Resources | Free-tier max | quota review, upgrade triggers wired | cost IDR 0 maintained | — |

Related: README.md · PRIORITY_MATRIX.md
