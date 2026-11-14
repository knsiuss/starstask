# Index Audit — Measured vs Theoretical

Evidence: `pg_indexes` (public), `pg_stat_user_tables` (seq/idx scans), index names.

## Measured (from pg_stat)

| Table                              | seq_scan / seq_tup_read | idx_scan | n_live | Verdict                                                                                                                                                                                                        |
| ---------------------------------- | ----------------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class_members`                    | 23903 / 357726          | 37331    | 30     | Hot RLS path, tiny size — cache at app layer, consider `is_class_member` memoization in same request (already done for `listMyClasses` via `cebc170`). Do not add index; already indexed (`pkey`, `user_idx`). |
| `profiles`                         | 7484 / 108814           | 2339     | 32     | Seq dominates — member-list queries (`loadProfiles`) run per page. P2: batch load (already single query), avoid per-member N+1.                                                                                |
| `discussion_session_checkins`      | 1133 / 105137           | 4678     | 129    | Mixed; recap needs `(session_id)` composite — exists via `session_idx` + `one_per_user`. OK at 129, watch at 10k.                                                                                              |
| `assignments`                      | 4864 / 7665             | 8514     | 4      | Index healthy (10 indexes incl. `search_idx`, `public_recent_idx`, `review_queue_idx`). Slight over-indexing (10 on 4 rows) — harmless now, prune after prod traffic measured.                                 |
| `attendance_verification_attempts` | 228 / 12430             | 1632     | 55     | Only `session_idx`. Theoretical P2 composite `(session_id, user_id, created_at)`.                                                                                                                              |
| `class_subjects`                   | 602 / 3463              | 5491     | 8      | Index healthy.                                                                                                                                                                                                 |

## Duplicate / redundant candidates

- `notification_events`: `due_idx`, `dedupe_key`, `user_recent_idx`, `user_unread_idx` — overlapping prefix `(user_id)`. Candidate to merge after `EXPLAIN` on real queries. UNKNOWN without pg_stat_statements.
- `discussion_sessions`: 7 indexes (`class_idx`, `upcoming_idx`, `public_upcoming_idx`, `attendance_open_idx`, `class_subject_meeting_uniq`, …). `upcoming` vs `public_upcoming` overlap. P2: keep both until query split measured.
- `assignments`: `class_idx` + `course_idx` + `subject_idx` — largely redundant prefixes. P3 cleanup after prod-scale EXPLAIN.

## Missing candidates (theoretical, need EXPLAIN before creating)

1. `course_materials (subject_id, created_at)` — only `subject_idx` exists.
2. `leave_request_history (request_id, created_at)` — only `request_idx`.
3. `audit_logs` retention queries — `created_idx` exists, good.

## FK indexing

- 112 FKs; most child tables have `*_idx` on FK columns (seen in index list). Spot-check: `assignment_attachments_assignment_idx`, `class_invitation_acceptances_key`, `save_assignment_*`. No obvious missing FK index from name list alone. Full coverage NOT VERIFIED — script it before any bulk DDL.

## Rule

No index changes in this phase (stop condition). All candidates above require `EXPLAIN ANALYZE` on staging at realistic volume first.
