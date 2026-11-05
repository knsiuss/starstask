# Connection management — Phase 5K

> **Date:** 2026-11-05. **Status: audit only, no config changed.**
> **Rule:** do not add PgBouncer — existing Supavisor functionality satisfies the requirement.

## 1. What the config says

Local `supabase/config.toml`:

- Supavisor is the connection pooler built into Supabase GoTrue/PostgREST stack.
- No additional PgBouncer deployment is defined in repo (no `pgbouncer.ini`, no custom pooler config).

## 2. Risks assessed

| Risk | Fact | Action in 5K |
| --- | --- | --- |
| Direct connections from serverless exceed `max_connections` | Supavisor in **transaction mode** multiplexes concurrent app calls onto a fixed server pool. Named prepared statements are incompatible with transaction mode (use `SET LOCAL` / query-level parameters instead of `PREPARE`, which supabase-js already does via PostgREST). | No change |
| Prep statements break | Same as above | No change |
| Connection exhaustion | Monitor: see §3 | No change |
| Transaction duration | Long transactions hold a pooled slot; use `SET statement_timeout` per call | No change |
| Serverless warm-start connection churn | Supavisor tolerates; adding another pooler would add latency and a failure domain | No change |

## 3. Booking measurements for 5N

- `SELECT count(*) FROM pg_stat_activity WHERE state = 'active';` (connection count over time)
- Pool active vs idle in Supabase dashboard → Database → Pooling
- `pg_stat_statements` median/mean duration for the batched RPC (`session_checkin_summary_many`)

> This phase did not record p50/p95/p99 or pool saturation — left as NOT MEASURED for 5N.

## 4. Conclusion

No PgBouncer needed. Supavisor (transaction pooling) is already the right tool. Future load work (5N) should measure pool occupancy under the scenarios in the brief; only if Supavisor saturation is proven would a pooler-size/churn change be considered — and that would be config-only, still with no new dependency.
