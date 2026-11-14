# Priority Matrix

| ID   | Finding                         | Priority | Effort | Dependencies |
| ---- | ------------------------------- | -------- | ------ | ------------ |
| F-01 | Dashboard/action-center fan-out | P0       | M      | Phase 0      |
| F-02 | RLS per-row overhead            | P1       | M      | EXPLAIN      |
| F-03 | Sync exports/OCR                | P1       | M      | job queue    |
| F-04 | Signed URLs per file            | P1       | M      | R2           |
| F-05 | Router.refresh patterns         | P2       | S      | Phase 2      |
| F-06 | Unbounded lists                 | P1       | S      | Phase 1      |
| F-07 | Multi-tenancy absent            | P1       | L      | Phase 5–6    |
| F-08 | Redis caching gap               | P2       | S      | Phase 2      |

Related: README.md · RISK_AND_REGRESSION_MATRIX.md
