# 27 — Schema Constraints & Indexes

## 27.1 Constraint standards (RECOMMENDED)

- All PKs `uuid`; FKs default `ON DELETE CASCADE` for tenant-derived children, `RESTRICT` for catalogue roots (`courses`), `SET NULL` only where history must survive (moderation pointers).
- CHECKs for all status/enum columns; length CHECKs for free text (existing pattern VERIFIED from `20261029000900_classes.sql`).
- `UNIQUE (id, university_id)` on every parent that children reference via composite FKs (offerings, classes, meetings, batches).
- Partial uniques for "one active" invariants (home class, active enrollment, active admin).

```sql
-- Conceptual examples (target design, NOT to be run as-is)
CREATE UNIQUE INDEX one_active_home_membership
  ON class_memberships (student_identity_id)
  WHERE is_home AND left_at IS NULL;
CREATE UNIQUE INDEX one_active_enrollment
  ON enrollments (offering_id, student_identity_id)
  WHERE status = 'active';
-- Last-admin guard (Domain I, §15.5)
CREATE OR REPLACE FUNCTION prevent_last_admin_removal() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM class_admin_assignments
      WHERE class_id = OLD.class_id AND revoked_at IS NULL) <= 1 THEN
    RAISE EXCEPTION 'cannot remove the last class admin' USING errcode = '42501';
  END IF;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;
```

## 27.2 Recommended indexes — query, benefit, write cost, storage, selectivity

| Index                                                                                   | Query it serves                                                       | Benefit                                                                    | Write cost                              | Storage                       | Selectivity note                                                                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `(university_id, …)` tenancy-prefix on every TENANT_OWNED table                         | All RLS-filtered + tenant-scoped queries (`WHERE university_id = $1`) | Makes RLS tenant filter index-only; tenant list pages avoid full scans     | One extra btree per write batch         | Moderate (uuid)               | High when many universities share the table; Low (wasted) if only ≤2 universities exist — Phase 5A to measure                                |
| `(offering_id, student_identity_id)` on `enrollments`                                   | Roster, attendance board, grade publish joins                         | Nested-loop/batch joins at pilot scale; unique constraint doubles as index | Per-enrollment row                      | Moderate                      | High (near-unique key)                                                                                                                       |
| `(offering_id, student_identity_id)` unique-partial (active)                            | "One active enrollment" invariant + roster                            | Integrity + lookup in one structure                                        | Per status change                       | Moderate                      | High; partial (WHERE status='active') keeps dropped rows out                                                                                 |
| `(meeting_id, status)` on `attendance_records`                                          | Meeting board counts (`GROUP BY status`)                              | Index-only aggregate for ≤ few hundred rows/meeting                        | Per record                              | Small                         | Medium — status has only 5 values; date-leading `(meeting_id, recorded_at)` may be better if board queries time-filter (Phase 5A to confirm) |
| `(batch_id, published)` on `grade_entries`                                              | Verify→publish scans                                                  | Targeted scans during publish RPC                                          | Per entry                               | Moderate                      | Medium (published is boolean — partial index `WHERE published` may serve better; measure)                                                    |
| `(rule_id, instance_date)` unique on `schedule_instances`                               | Idempotent materialization                                            | Prevents duplicate instances on re-run                                     | Per instance                            | Small                         | High (unique)                                                                                                                                |
| `(class_id, student_identity_id)` active-partial on `class_admin_assignments`           | Admin roster + last-admin count                                       | Integrity + guard trigger                                                  | Per grant/revoke                        | Small                         | High                                                                                                                                         |
| `(token_hash)` unique on `course_invite_tokens`                                         | Token redeem lookup                                                   | Single-index redeem path                                                   | Per token                               | Small                         | High (unique)                                                                                                                                |
| GIN `search_vector` on `assignments` (existing, VERIFIED)                               | Full-text feed & search                                               | Ranked search without regex fallback                                       | Per assignment update                   | Largest of the set (tsvector) | Medium — worth its cost only if full-text is a primary hot path (it is, per contract sorts); keep                                            |
| `(created_at DESC)` on `audit_logs` / `notification_deliveries` / `notification_events` | Retention sweeps + admin lists                                        | Range scans for purge windows                                              | Per insert (sequential-append friendly) | Large over time               | Low per-row, high aggregate — retention strategy in `33` must accompany                                                                      |
| `path` prefix (btree/trgm) on `academic_units`                                          | Subtree queries (programs under faculty)                              | Avoids recursive CTE on every browse                                       | Per move (re-write descendants)         | Small                         | High per unit; low query frequency until org browsing grows                                                                                  |

## 27.3 Existing constraint/index evidence (VERIFIED)

- `classes_slug_key` UNIQUE `slug`; `classes_course_idx` partial (`WHERE status='active'`); `classes_active_recent_idx (created_at DESC)` partial — all in `20261029000900_classes.sql`.
- `courses_normalized_name_key` UNIQUE `normalized_name`; `courses_normalized_code_idx` partial — `20261029000100_core_schema.sql`.
- Composite PKs (VERIFIED): `class_members`, `class_admins`, `class_subject_members`, `saved_assignments`, `notification_preferences`, `discussion_session_rsvps`.
- `assignment_reviews_decision_allowed`, `class_members_joined_via_allowed`, `classes_status_allowed`, attendance five-status CHECK (`20261107000000`), invite `token_hash` length-64 + `max_uses`/`used_within_max`/`expiry_after_creation` checks (`20261029000900`).
- 108 index-creation occurrences, 43 trigger creations (VERIFIED counts). Full catalog: `docs/database/architecture/INDEX_CATALOG.md` (REPORTED, 83 KB).

## 27.4 Guidance

- Only add indexes justified by a hot-path query (see `25` §25.1); prefer composite `(university_id, …)` tenancy-prefix indexes for every tenant-owned table (RLS evaluates per-university filters).
- Avoid blanket indexes on low-selectivity flags; Phase 5A to confirm with `EXPLAIN` + `pg_stat_user_tables` before adding.

**Cross-refs:** `23` (§23.2/23.3), `25`, `26` §26.1, ADR-013/017.
