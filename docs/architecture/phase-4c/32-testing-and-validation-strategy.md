# 32 — Testing & Validation Strategy

> **Status:** DRAFT. All tests are FUTURE (Phase 5.x) — none executed in Phase 4C.

## 32.1 Integrity tests

- Composite-FK rejection: insert `enrollments` with mismatched `(offering_id, university_id)` → must fail.
- Unique enforcement: duplicate active home membership / active enrollment / per-tenant NIM → must fail.
- Last-admin guard: revoke last `manage_admins` holder → must fail.
- Grade score bounds: `score > max_score` → must fail.

## 32.2 Tenant isolation tests (concrete cross-tenant scenarios)

1. **Cross-tenant read:** user A (University X member) SELECTs classes of University Y → must return **0 rows** (RLS).
2. **Cross-tenant RPC write:** redeem invite token from University Y while acting as University X user → must fail; token_hash lookup is tenant-scoped.
3. **Cross-tenant storage:** signed URL for path `X/…` requested with Y session → must deny.
4. **Retake isolation:** student enrolled in offering O (retake) must NOT see O's classmates' other offerings or home-class data they lack membership in.
5. **MQTT-style poll:** run every tenant-scoped contract query suite twice (as X, as Y) and diff rowsets (must be disjoint).

## 32.3 Authorization tests

- `is_class_member()` false → RPCs raising `42501` (existing pattern).
- `manage_*`-scoped ops: each permission exercised allow/deny per resource.
- Platform-Admin-only universe activation: non-admin → denied.
- Grading publish requires `manage_grades`; attendance corrections require `manage_attendance`.

## 32.4 Performance benchmarks (FUTURE — labelled as scenarios)

Seeded 10 universities × 50 classes × 30 students: roster, attendance board, feed, and grading publish queries measured via `EXPLAIN ANALYZE`; index decisions validated before merge.

## 32.5 Migration validation

- Backfill row counts per phase (old vs new); constraint-verification queries; dual-write drift checks; rollback rehearsal in staging before production.
