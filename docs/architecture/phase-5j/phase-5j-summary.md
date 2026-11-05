# Phase 5J summary — StarsTask database audit and baseline

> **Date:** 2026-11-05. **Scope:** 5J-A through 5J-D. **No code or schema changes made.**
> **Verdict: INCOMPLETE — production baseline and staging clone are missing; multi-tenant paths remain inert.**

## 1. Deliverables

| File                       | Status                                                  |
| -------------------------- | ------------------------------------------------------- |
| `database-inventory.md`    | Created with local/production inventory and evidence    |
| `schema-parity.md`         | Created; parity **FAIL**                                |
| `application-query-map.md` | Created with static access mapping                      |
| `performance-baseline.md`  | Baseline **NOT MEASURED**; document states no benchmark |
| `bottleneck-analysis.md`   | Candidate bottlenecks listed with required validation   |
| `recommendations.md`       | Sequencing and gates for 5K–5O                          |
| `phase-5j-summary.md`      | This file                                               |

## 2. Key facts verified

1. **Repository** has 90 migration files. Ledger in both local and production shows 82 applied, ending at `20261109000000`.
2. Local working DB has **77 public tables**; production **52**. Difference: 25 Phase 5A–5G tables absent from production.
3. Local schema appears to have been materially constructed by executing migration SQL out-of-ledger. Therefore local numbers are not parity evidence.
4. Public policies local 108 vs production 83; indexes 279 vs 175; functions 164 vs 159; triggers 56 vs 40; constraints 627 vs 432.
5. WIP `20261110000000_subject_enrollment.sql` remains quarantined/unapplied.
6. Production settings observed: PostgreSQL 17.11, ~19 MB DB, `max_connections=60`, `shared_buffers` configured.
7. Source-level query counts in `apps/web/src`: 409 `.from()`, 124 `.rpc()`, 321 `.select()`, 45 exact-count queries, 112 `Promise.all`.
8. No runtime multi-tenant negative test has run; 5J cannot establish tenant security by documentation alone.
9. Existing backup recovery gate is still **INCOMPLETE**.
10. Contract boundary: Phase 5 features and tables are not active in production; activation requires explicit platform/product decision and migration rehearsal.

## 3. NOT YET VERIFIED

- p50/p95/p99 latency.
- Connection pool saturation.
- Cache hit ratio and buffers.
- Database CPU/memory.
- Realistic load or staging clone results.
- `EXPLAIN (ANALYZE, BUFFERS)` results.
- Cross-university RLS negative tests.
- Production data growth rates.
- Backup/restore full gate closure.

## 4. Blocking decisions / access

| Needed                                     | Why                                         | Who                       |
| ------------------------------------------ | ------------------------------------------- | ------------------------- |
| Isolated staging database                  | Enables 5K–5N verification                  | Owner / platform engineer |
| Authorized production read-only snapshot   | Establishes real baseline and query map     | Owner / DBA               |
| ADR-002 / product activation sign-off      | Multi-tenant product remains inert          | Platform/product owner    |
| Backup/restore closure                     | Any production migration is NO-GO otherwise | Owner                     |
| Explicit approval to attempt any migration | Changes are otherwise prohibited            | Owner                     |

## 5. What was not done

- No production or local migration applied.
- No index created.
- No Redis/cache dependency added.
- No authorization weakened.
- No load test generated.
- No claim that production is ready or secure.

## 6. Acceptance criteria status

| Criterion                            | Status                               |
| ------------------------------------ | ------------------------------------ |
| Schema parity verified               | **FAIL**                             |
| Application workload measured        | **NOT MEASURED**                     |
| Bottlenecks identified with evidence | **PARTIAL** — static candidates only |
| 5K optimization authorized           | **NO**                               |
| Multi-tenant security verified       | **NOT TESTED**                       |
| 5N/5O complete                       | **NOT STARTED / NOT VALIDATED**      |

## 7. Standby state

**Phase 5J is complete as documentation; Phase 5K/5L/5M/5N/5O are blocked, not implicitly approved.**

Next safe work after owner supplies staging + gate closure: collect measurements, then 5K benchmark, then 5L caching design/implementation, then 5M negative testing.
