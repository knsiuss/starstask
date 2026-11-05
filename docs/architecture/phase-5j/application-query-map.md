# Application query map — Phase 5J

> **Generated:** 2026-11-05. **Read-only static analysis.** No runtime query log was provided.
> Search counts below are **occurrence counts in source, not request frequency**.

## 1. Source-level signal counts

Across `apps/web/src` (`.ts` / `.tsx`):

| Pattern          | Occurrences | Interpretation                                         |
| ---------------- | ----------: | ------------------------------------------------------ |
| `.from(`         |         409 | Direct table/PostgREST reads/writes; broad usage       |
| `.rpc(`          |         124 | Intended authorization/business logic boundary         |
| `.select(`       |         321 | Projection usage; many are explicit columns, not `*`   |
| `count: "exact"` |          45 | Potential repeated read work; audit each high-hit path |
| `Promise.all`    |         112 | Mostly batching, but includes N+1-by-map candidates    |

## 2. High-impact access patterns

### 2.1 Authentication / membership lookup

| Caller                                                      | Access                                                     | Risk                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web/src/lib/auth/session.ts:44`                       | `.from("profiles")`                                        | Profile lookup on auth path                                                                |
| `apps/web/src/lib/authz/class-permission.ts:44,139,204,281` | `.from("classes").select("id, university_id", ...)`        | Repeated tenant re-validation; acceptable security cost, caching must keep user-scoped key |
| `apps/web/src/lib/db/classes.ts`                            | `is_platform_admin` + `is_class_member` + `is_class_admin` | Three RPC calls per class-scoped check pattern                                             |
| RLS helper functions                                        | `is_class_member`, `can_manage_class`                      | Used inside policies; high-frequency in future load                                        |

### 2.2 Attendance path

| Caller                                                         | Access                                                                                                   | Risk                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web/src/lib/db/attendance-meetings.ts:148`               | RPC `class_attendance_meeting_list`                                                                      | Bounded list expected; verify `limit` and `p_class_id` index            |
| `apps/web/src/lib/db/attendance-meetings.ts:165-229`           | Direct `.from("discussion_sessions")`, `.from("class_subjects")`, `.from("discussion_session_checkins")` | Broad projection may be wide; explicit columns mitigate                 |
| `apps/web/src/lib/db/attendance-meetings.ts:455-457`           | `Promise.all(selected.map(... rpc("session_checkin_summary")))`                                          | **N+1 RPC pattern**; one RPC per selected meeting; verify meeting limit |
| `apps/web/src/lib/db/attendance.ts:616`                        | RPC `session_checkin_summary` in loop-like context                                                       | Same candidate rule                                                     |
| `apps/web/src/features/attendance-meetings/meeting-service.ts` | `check_in_attendance_meeting`, corrections                                                               | Authoritative write path; do not bypass                                 |

### 2.3 Assignment listing and submission

| Caller                                               | Access                                        | Risk                                                        |
| ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/lib/db/assignments.ts:177`             | RPC `list_assignments`                        | Primary filtered list; needs server-side pagination proof   |
| `apps/web/src/lib/db/assignments.ts:206,220,250,...` | `.from("assignments")` + explicit projections | Review for joins/count exact costs                          |
| `apps/web/src/lib/db/assignments.ts:463-465`         | two `count: "exact"` queries                  | Potential expensive read count at scale                     |
| `apps/web/src/features/assignments/*`                | `count: "exact"` head queries                 | Rate of these calls matters, not existence                  |
| `apps/web/src/lib/db/assignment-completions.ts`      | direct `assignment_completions`               | Upsert/merge pattern; indexed PK `(assignment_id, user_id)` |

### 2.4 Leave / requests

| Caller                                              | Access                                             | Risk                                                       |
| --------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/lib/db/leave.ts`                      | tables + leave RPCs                                | Domain state; correctness is more important than cache     |
| `apps/web/src/features/leave/leave-service.ts`      | `create/update/submit/cancel/review_leave_request` | Permission enforced in database/RPC                        |
| `apps/web/src/features/leave/forwarding-service.ts` | `complete_leave_forwarding`                        | Contains recipient metadata; Phase 4B flagged PUBLIC grant |

### 2.5 New Phase 5 / multi-tenant paths

| Caller                                        | Access                                   | Risk                                                                          |
| --------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/lib/db/class-permission.ts`     | classes lookup with `university_id`      | Hot path for every permission decision                                        |
| `apps/web/src/lib/db/class-admins-service.ts` | `classes` + RBAC tables                  | Multi-query grant/revoke flow; wrap in RPC/transaction in 5E/5I follow-up     |
| `apps/web/src/lib/db/announcements.ts`        | tenant-scoped announcements/read status  | Avoid caching cross-user; reads are personalized                              |
| `apps/web/src/lib/db/academic-attendance.ts`  | namespace with many direct table queries | New/unproven under production data; do not activate before staging benchmarks |

## 3. Repeated request patterns

1. **Auth → membership → class permission → query** is the default request path. It is correct security-wise but has redundant round trips.
2. **Batch reads via `Promise.all`** are usually fine; patterns where containers iterate over result sets and issue one RPC per item are explicitly flagged.
3. **Count-exact head queries** are common for UI totals; they can become dominant costs if shown on index pages.
4. **RPCs carrying authz decisions** mix business logic and access control. This prevents leaky direct table bypass but makes query plans opaque to the app layer.
5. **New Phase 5 services** are effectively dormant/inert; no load evidence exists.

## 4. Pagination

Observed helpers and repeated `limit(MAX_ROWS)` patterns confirm bounded result construction in some paths, but pagination is not uniformly enforced. Exact count usage indicates offset-count UI feedback in several screens. Full per-route audit remains outstanding; runtime evidence is required.

## 5. N+1 candidates

| Candidate                                              | Evidence                     | Required validation                                                                                                 |
| ------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `attendance-meetings.ts` `session_checkin_summary` map | one RPC per selected meeting | Measure meeting list page with seeded meetings; replace with one set-returning RPC only if benchmark shows hot path |
| `attendance.ts` `session_checkin_summary` per session  | same RPC pattern             | Same                                                                                                                |
| `classes.ts` membership + role RPCs                    | repeated RPC checks          | Profile actual request timings; cache only by authenticated user+class                                              |
| Any `Promise.all` over mapped RPC calls                | occurrence count 112         | Classify each before editing                                                                                        |

No code was changed in Phase 5J.

## 6. Next evidence

- Production `pg_stat_statements` top queries (authenticated read-only).
- `EXPLAIN (ANALYZE, BUFFERS)` only on staging clone with synthetic data.
- Request trace with request count and p50/p95/p99.
