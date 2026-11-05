# Performance baseline — Phase 5J

> **Date:** 2026-11-05. **Read-only.** No load generation or `EXPLAIN ANALYZE` was run.
> **Status: INCOMPLETE — runtime production baseline not measured.**

## 1. What is verified

### Local database

- PostgreSQL 17.11 in docker `supabase_db_starstask`.
- `pg_stat_statements` extension exists and can return stored statement statistics.
- Local app database is not representative of production traffic.
- Top observed statements are the audit dump queries executed by this audit (e.g. `COPY (...)`), not application workload.

### Production (read-only metadata only)

- Project `starstask` (`kdqsrckmmoucdqiapovr`), PostgreSQL 17.11.
- Configuration observed via read-only query:

| Setting                    | Value                                 |
| -------------------------- | ------------------------------------- |
| `shared_buffers`           | 28672 (units not re-interpreted here) |
| `effective_cache_size`     | 49152                                 |
| `work_mem`                 | 2184                                  |
| `max_connections`          | 60                                    |
| `random_page_cost`         | 1.1                                   |
| `effective_io_concurrency` | 200                                   |

- Database size ~19 MB; public application data ~3.4 MB.
- Production catalog counts: 52 tables, 175 indexes, 83 public policies, 159 functions, 40 triggers.

## 2. What is NOT measured

| Metric                               | Status                                       |
| ------------------------------------ | -------------------------------------------- |
| p50 / p95 / p99 latency              | **NOT MEASURED**                             |
| Query execution time by route        | **NOT MEASURED**                             |
| Database CPU / memory                | **NOT MEASURED**                             |
| Connection count and pool saturation | **NOT MEASURED**                             |
| Transaction throughput               | **NOT MEASURED**                             |
| Buffer cache hit ratio               | **NOT MEASURED**                             |
| Disk I/O                             | **NOT MEASURED**                             |
| Lock waits / deadlocks               | **NOT MEASURED**                             |
| Slow query frequency                 | **NOT MEASURED**                             |
| Production table growth rates        | **NOT MEASURED**                             |
| `EXPLAIN (ANALYZE, BUFFERS)`         | **NOT RUN** — no safe staging clone supplied |

## 3. Local statistics cannot be used as production baseline

The local stack contains the ad-hoc Phase 5A–5G working schema and almost no live traffic. Any numbers derived from it would measure the audit itself, not user workload. Therefore no before/after optimization can be claimed from this environment.

## 4. Production statistics available but unmeasured

The following should be collected from an authorized production read-only session:

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  rows
FROM
  pg_stat_statements
ORDER BY
  total_exec_time DESC
LIMIT
  25;

SELECT
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM
  pg_stat_user_tables
ORDER BY
  seq_tup_read DESC
LIMIT
  25;
```

These queries are read-only and should be executed by an authorized production operator. No such snapshot was captured in this pass.

## 5. Baseline verdict

**Not ready for optimization claims.**

The only valid next decisions are:

1. Establish staging clone from committed migrations;
2. Seed synthetic multi-university data;
3. Measure application workload;
4. Run `EXPLAIN (ANALYZE, BUFFERS)` only on staging;
5. Then implement and validate targeted 5K changes.

No benchmark result is present in this repository for the Phase 5 candidate changes.
