# 30 — Data Migration Strategy

> **Status:** DRAFT. **Expand-contract only** (no destructive cutover). No production data touched in Phase 4C.

## 30.1 Expand–contract pipeline (RECOMMENDED)

1. **Expand:** create NEW tables/columns (nullable), add indexes concurrently, backfill in batches (tenant-scoped, resumable via `WHERE id > last_id`).
2. **Dual-write window:** application writes both shapes behind a feature flag; reads prefer new shape with fallback (RECOMMENDED — keeps rollback trivial).
3. **Cutover:** reads switch; keep old shape 1 release.
4. **Contract:** drop/re-key old columns with `SET NOT NULL` + FKs added after backfill verification.

## 30.2 Migration risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Identity bridge (`user_id`→`student_identity_id`) ambiguous for ghost users | orphan memberships/enrollments | auto-create pending `student_identities` for unmatched `profiles`; manual review queue |
| NIM duplicates across free-text `university` strings | per-tenant unique fails | normalize `university` strings to registry rows first (UNRESOLVED mapping — see below); dedupe with audit trail |
| `academic_period_id` backfill for offerings | null periods | default period per university via Platform Admin (CONFIRMED gate) |
| Schedule rules→instances materialization cost | large scans | index-first, batch by offering, resumable |
| Storage path prefixing | signed-URL breakage | keep old paths valid during window; dual-read |

## 30.3 Legacy `university` string → registry mapping (UNRESOLVED)

`profiles.university` free text cannot be reliably mapped (typos, abbreviations). Strategy: Platform Admin reviews distinct values → maps to `universities` rows; unmapped values stay flagged; classes get `university_id` via their creator's verified identity where unambiguous. **Do not auto-map.**

## 30.4 Compatibility & rollback

- Every phase keeps old tables queryable; rollback = flip reads back + keep dual-writes until green.
- No `DROP COLUMN` in the same release as its replacement's backfill (contract step is always a separate, later migration).
- Backfill scripts are idempotent (`INSERT … ON CONFLICT DO NOTHING`) and chunked by `university_id` once keyed.

## 30.5 Order (RECOMMENDED)

B-domain build (universities) → E (student_identities + backfill) → F/G (classes/membership/offerings/enrollments) → H (invite tokens) → I (admin split) → K (meetings/records) → M (schedule) → L (grades) → N/O/P/Q polish. See `35-implementation-roadmap.md`.
