# 18 — Domain L: Grading

- **Decision: CONFIRMED** — grading via CSV upload by class admin; distinguish assignment/course grades, upload batches, changes, history, verification/publication.
- **Existing equivalent: VERIFIED-ABSENT.** No grade tables, no CSV template, no grade columns in any of 83 migrations (grep `grade|nilai` = 0 hits). Format evidence: **UNRESOLVED**.
- **Target (PROPOSED, pending format decision):**
  - `grade_batches(id, offering_id, uploaded_by, source_file_hash, status: uploaded/verifying/published, created_at)`.
  - `grade_entries(batch_id, student_identity_id, component: assignment/course, score numeric, max_score, published, published_at)`.
  - `grade_history(entry_id, old_score, new_score, changed_by, reason, changed_at)` — append-only.
- **Lifecycle:** uploaded → verifying → published → (correction creates new history row, never in-place update).
- **Upload path:** CSV parse server-side → staging rows → admin verify → publish RPC; every transition audit-logged.
- **UNRESOLVED (see `36`):** CSV column contract, score scale, retake-with-existing-grades policy, lecturer-grading overlap, grade visibility scope (class-only vs cross-class).

> The brief CONFIRMS the CSV-upload _mechanism_ but repo evidence cannot supply the CSV _format_. Phase 5A must elicit a sample file before any migration is written.
