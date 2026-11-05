# Risk & Regression Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RPC aggregation changes numbers | M | High | snapshot tests vs. existing aggregates |
| Index add slows writes | L | M | measure `pg_stat_statements` pre/post |
| R2 cutover breaks downloads | L | High | dual-read + staged bucket migration |
| Tenant backfill mis-scopes rows | L | Critical | count assertions + reversible columns |
| Job queue drops notifications | L | M | idempotency + retry + alert |
| Cache stale across tenants | L | High | tenant-keyed keys, short TTL |

Related: README.md · ACCEPTANCE_CRITERIA.md
