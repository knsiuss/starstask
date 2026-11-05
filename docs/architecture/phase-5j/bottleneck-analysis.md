# Bottleneck analysis — Phase 5J

> **Generated:** 2026-11-05. Evidence labels: **VERIFIED**, **INFERRED FROM STATIC ACCESS PATTERNS**, **UNMEASURED**.
> No performance improvement is claimed.

## 1. Candidate bottlenecks

### B-1. RLS + class-membership checks (VERIFIED MAY BE HIGH-VALUE)

**Evidence**

- Application performs class-permission RPCs/direct lookups before protected work.
- Phase 3 previously measured 23,903 seq-scans on `class_members` before targeted work.
- New permission path `class-permission.ts` repeats `.from("classes").select("id, university_id")` several times.
- RLS policies call stable membership helpers.

**Why it matters**

Each request can re-evaluate tenant/class membership multiple times. At 10/100 concurrent users, this is correct-but-expensive; at 10,000 users it becomes saturation before business logic does.

**Needed evidence**

`pg_stat_statements`, `pg_stat_user_tables`, application traces, and staging benchmark.

**Safe candidate**

In 5K/5L: benchmark request-scoped caching (memoize permission per authenticated user+class within request), or set-returning helper only if measured.

### B-2. N+1 RPC on attendance meeting lists (INFERRED)

**Evidence**

`lib/db/attendance-meetings.ts:455-457` uses `Promise.all(selected.map((row) => supabase.rpc("session_checkin_summary", ...)))`.
Another `session_checkin_summary` site exists in attendance paths.

**Why it matters**

One extra RPC per meeting. If page shows 20–50 meetings, latencies add per user and connection pool occupancy grows.

**Needed evidence**

Staging benchmark with synthetic meetings; count RPCs per request via trace.

**Safe candidate**

Compare current behavior against a single set-returning RPC (e.g. list summaries) only after correctness tests. Do not modify until measured.

### B-3. Exact-count queries (INFERRED)

**Evidence**

45 `count: "exact"` occurrences. Examples include assignment count heads.

**Why it matters**

Exact counts force scanning/filter evaluation even when UI just needs a navigation hint.

**Needed evidence**

Count which are rendered frequently; EXPLAIN in staging.

**Safe candidate**

Replace unnecessary `count: "exact"` with estimated/total query or no count for large datasets, per route.

### B-4. Direct table broad access (INFERRED)

**Evidence**

409 `.from(` occurrences across app.

**Why it matters**

Scattered copies of query logic increase divergence, re-application of RLS overhead, and stale-cache risk. RPCs are central but some critical paths remain direct.

**Needed evidence**

Query map review per route; catalog of selects from sensitive tables.

**Safe candidate**

No blanket refactor. Centralize only high-cost/destructive flows.

### B-5. Append-only growth domains (INFERRED)

**Evidence**

`audit_logs`, attendance records/corrections, notifications, assignment revisions are append-style or high-volume candidates. Phase 4B found no verified partitioning.

**Why it matters**

Index/table bloat will degrade sequential scans and write latency as data grows.

**Needed evidence**

Production `pg_stat_user_tables` + growth forecast.

**Safe candidate**

Retention and partition review; not immediate index work.

## 2. Non-bottlenecks

| Area                                    | Why                                                 |
| --------------------------------------- | --------------------------------------------------- |
| Database size today                     | ~19 MB production; not a data-volume bottleneck     |
| RLS being enabled                       | Not by itself a performance problem at current size |
| Repeated catalog escrow / audit queries | Audit artifacts, not normal user path               |
| New Phase 5 inert UI                    | No production traffic yet, so not bottlenecks       |

## 3. Relative ranking (current knowledge, not benchmark)

1. Authorization/membership check frequency — **highest risk** at scale.
2. N+1 attendance summaries — **high risk** if meetings per page allowed.
3. Exact-count and broad projection paths — **medium risk**.
4. Append-only growth — **long-term risk**.
5. New tenant schema production performance — **unknown; absent**.

## 4. Required validation before action

- Clone production-like staging.
- Seed at least one university; synthetic class and membership volume.
- Measure before any index/cache change.
- Validate correctness and authorization after every change.
