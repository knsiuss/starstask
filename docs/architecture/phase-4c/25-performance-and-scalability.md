# 25 — Performance & Scalability

> **Status:** DRAFT. **No live DB access** — stats are REPORTED; workload model is HYPOTHETICAL.

## 25.1 Hot paths & N+1 risks (INFERRED from app + RPC patterns)

| Path | Evidence | Risk |
|------|----------|------|
| Class roster / member lists | `class_attendance_member_summary`, `class_attendance_roster` | N+1 if UI fetches per-member separately; RPC batch reads preferred |
| Assignments feed | `assignments` + `search_vector` GIN (VERIFIED) | Full-text OK; verify GIN actually exists in prod (get catalog in Phase 5A) |
| Attendance check-in | `check_in_*` + verification attempts + roster summaries | Write amplification during open window (per-student row + attempts); batch inserts RECOMMENDED |
| Notification fan-out | claim/complete outbox + API cron | Polling latency vs throughput; keep batch size bounded |
| RLS predicates | `is_class_member()` EXISTS per row | EXISTS is index-friendly; ensure `(class_id, user_id)` PK support (VERIFIED composite PK maps to `class_members`) |

## 25.2 Indexes (VERIFIED from migrations)

- `courses_normalized_name_key` (UNIQUE), `courses_normalized_code_idx` (partial); `search_vector` GIN on assignments (VERIFIED in `20261029000100`).
- 108 `create index` occurrences (VERIFIED count; includes repeated guarded creates). Full catalog: `docs/database/architecture/INDEX_CATALOG.md` (REPORTED, 83 KB).
- **Missing-index candidates (PROPOSED, Phase 5A to verify with `pg_stat_user_tables` + `EXPLAIN`):** `(offering_id, student_identity_id)` on enrollments; `created_at` on audit/notification tables if retention scans run; `path` on academic_units if subtree queries grow.

## 25.3 Representative workload SQL (HYPOTHETICAL targets)

```sql
-- Class roster for an offering (target schema)
SELECT si.student_id_number, p.display_name
FROM enrollments e
JOIN student_identities si ON si.id = e.student_identity_id
JOIN profiles p ON p.id = si.user_id
WHERE e.offering_id = $1 AND e.status = 'active';
-- Attendence meeting board
SELECT status, COUNT(*) FROM attendance_records WHERE meeting_id = $1 GROUP BY status;
```

## 25.4 Index strategy (justified only)

Only add indexes justified by hot-path queries above; prefer composite `(university_id, …)` tenancy-prefix indexes for every tenant-owned table (RLS evaluates per-university filters).

## 25.5 Data growth scenarios (HYPOTHETICAL — not projections)

- Pilot (REPORTED): ~30 class_members, ~273 audit_logs, ~3.4 MB data.
- Illustrative 10× university: audit_logs and checkins grow linearly with members×meetings; notification_deliveries with fan-out; storage grows with evidence/materials.

## 25.6 RPC architecture

RPCs are the write path for state transitions (atomic, audited). Reads mostly via RLS + typed Supabase client. Keep RPCs narrow (single transition + audit row); long CSV/grade imports must chunk (see `31`).

## 25.7 Audit retention: pg_cron vs app cron

- **Current (VERIFIED):** API cron routes `attendance-retention`, `notification-retention`, `session-jobs`, `notification-events`, `deadline-reminders`. `pg_cron` absent in migrations (VERIFIED).
- **RECOMMENDED:** keep API cron (matches deploy model); add DB-side archival RPCs + retention thresholds; revisit `pg_cron` in Phase 5B if retention windows need tighter guarantees (ADR-016 PROPOSED).
