# Performance Benchmark Plan

Targets (proposed engineering targets, not measured results):

| Metric                 | Target  | Measure with                    |
| ---------------------- | ------- | ------------------------------- |
| LCP                    | ≤ 2.5s  | Lighthouse CI in GitHub Actions |
| INP                    | ≤ 200ms | Playwright + web-vitals         |
| CLS                    | ≤ 0.1   | Lighthouse                      |
| Dashboard TTFB p95     | ≤ 800ms | k6 100-concurrent script        |
| Action Center TTFB p95 | ≤ 800ms | k6                              |
| Interactive API p95    | ≤ 500ms | k6                              |
| XLSX export p95        | ≤ 5s    | background job timing (Phase 4) |

Execute Phase 0 baseline before Phase 1 fixes; attach results to this doc; never present targets as results.

Related: README.md · LOAD_TESTING_STRATEGY.md
