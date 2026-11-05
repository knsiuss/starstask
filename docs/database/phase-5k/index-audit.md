# Index audit — Phase 5K

> **Date:** 2026-11-05. **Status: audit only, no index changed.**
> Rule: no index without staging proof.

## 1. What was inspected

| Table / area | Existing indexes (in catalog) | Audit note |
| --- | --- | --- |
| `class_members` | PK `(class_id, user_id)` + user index exists in catalog view | Membership checks are index-lookup shaped; no seq-scan measured on scratch DB |
| `discussion_session_checkins` | PK + session-scoped indexes exist | Workload is list-shaped (`session_id`, `user_id`); not measured |
| attendance tables | PK / scoped indexes exist | No `EXPLAIN (ANALYZE, BUFFERS)` run at production volume |
| `audit_logs` | PK + append-only hotspot historically named | Phase 3 numbers (not re-measured in 5K) — migration needs load evidence |
| notification tables | outbox + claim RPC uses `FOR UPDATE SKIP LOCKED` | Back-pressure is via claim, not index |
| `assignment_completions` | PK `(assignment_id, user_id)` exists | Fine-grained duplicates use PK conflict path |

## 2. Candidates considered and deferred

| Candidate | Query it would support | Why deferred |
| --- | --- | --- |
| `(class_id, created_at)` on check-ins / audits | time-ordered check-in and audit lists | Scratch DB has 120 rows — seq-scan cost is near zero; adding index increases write cost without proven win |
| `(user_id, created_at)` on notifications | inbox pagination | User-visible path; exact counts deliberately kept — new index needs staging p95 proof |
| Partial `(university_id, ...)` | tenant filtering (Phase 5A–5G tables) | Those tables are inert in prod; building indexes now pays cost with zero benefit |

> Deferred until: staging clone with production-like volume + `EXPLAIN ANALYZE BUFFERS` showing seq-scan starvation + a write-amplification note.

## 3. No `CREATE INDEX CONCURRENTLY`

No concurrent index was created. Supabase migrations / Supabase-managed DDL generally run inside a transaction; `CREATE INDEX CONCURRENTLY` cannot run there. Production index rollout would need a separate CONCURRENTLY path (the standard pattern is: migration with plain `CREATE INDEX IF NOT EXISTS` on off-peak, or a non-transactional operation).

## 4. Next measurement to unblock D

- Production read-only snapshot of `pg_stat_statements` (top 25 by total_exec_time) + `pg_stat_user_tables` (seq_scan / seq_tup_read).
- Synthetic 10k-checkin seed in staging, `EXPLAIN (ANALYZE, BUFFERS)` before/after any candidate index with `synchronize_seqscans` and `track_io_timing` mode noted.
- Write-amplification check: INSERT one synthetic row set with and without the index; compare timing.

No index migration is in `supabase/migrations` from Phase 5K.
