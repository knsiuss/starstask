# Load Testing Strategy (design only — no production load tests run)

Scenarios at 100/500/1k/5k concurrent users for: login, dashboard, class list, assignment list/submit, attendance load/submit, action center, absence submission, notification retrieval, export generation, file upload/download. Tools: k6 (free, Phase 7), Playwright (existing).

Measure latency p50/p95/p99, error rate, throughput, DB CPU/connections/cache-hit, Redis, memory, job throughput, tenant isolation assertions (cross-tenant queries return empty). Note: no capacity claimed until results exist.

Related: README.md · PERFORMANCE_BENCHMARK_PLAN.md
