# RLS benchmark — 2026-11-05 (production, read-only)

Method: `EXPLAIN (ANALYZE, BUFFERS)` via `supabase db query --linked`
with `SET ROLE authenticated` and a synthetic/member `jwt.claim.sub`.
No data was written. Local Docker was unavailable, so no seeded staging
stack; timings are at production volume (tiny), which understates
per-row cost at scale but proves the plan shape.

## Results

| Query shape                                 | Planning                   | Execution                      | Plan notes                                                                                                         |
| ------------------------------------------- | -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `classes` list (active, LIMIT 20)           | 21.5 ms                    | 2.1 ms                         | Seq scan (2 classes); filter calls `can_manage_class(id)` / `is_class_member(id)`                                  |
| `discussion_sessions` unscoped (LIMIT 20)   | 11.0 ms cold / 0.8 ms warm | 116 ms cold / **25.7 ms warm** | Seq scan, `can_view_session(id)` per row, 22 rows filtered out, 3856 buffers                                       |
| `discussion_sessions` class-scoped (member) | 0.8 ms                     | **15.0 ms** for 20 rows        | Index Scan Backward on `discussion_sessions_class_idx` (good), still `can_view_session(id)` per row (~0.75 ms/row) |

## What `can_view_session` does per row

`20261029001700_session_functions.sql:42-72`: fetch the session row,
then `is_platform_admin()`, `is_class_member(class_id)`,
`is_class_admin(class_id)`, and an RSVP `EXISTS` — four SECURITY DEFINER
lookups plus repeated `auth.uid()` subplans, for every candidate row.

## Flattened predicate validation (service_role, read-only)

A set-based rewrite of the same predicate (visibility OR platform admin
OR member OR class admin OR RSVP, each as `EXISTS ... (SELECT auth.uid())`):

- Member user: `can_view_session` count 22, flattened count 22 (equal).
- Non-member synthetic user: both 0 (deny path holds).
- Scoped query EXPLAIN: **0.33 ms** vs 15.0 ms original (45x), buffers
  14 vs 975, `auth.uid()` evaluated once as an InitPlan, hashed subplans
  for membership/RSVP.

A direct RLS policy rewrite was rejected: the subqueries would run
under the caller's table grants (`platform_admins` has no SELECT grant
for `authenticated`), so the safe change is rewriting the function body
only (migration `20261137000000`), which keeps the policy interface and
grants untouched.

## Interpretation

- The app always scopes session lists by `class_id`, so the unscoped
  25.7 ms case is worst-case, not representative. The representative
  scoped case is ~15 ms for 20 rows, dominated by per-row RLS calls.
- At current volume (tens of sessions per class) this is acceptable.
  It grows linearly with sessions per class and is the first thing that
  will hurt if a class accumulates hundreds of sessions.
- Planning time (up to 21.5 ms on the classes list) is the other half
  of the RLS cost: complex policy expressions are re-planned per query.

## After (migration `20261137000000`, production)

Same scoped query, same member user:

- Execution: **4.5 ms cold / 3.4 ms warm** (was 15.0 ms) — ~4.5x faster.
- Buffers: 475 (was 975).
- Equivalence re-check after the change: member count 22 (unchanged),
  non-member count 0 (deny path holds).
- Branching was unavailable (Pro plan required) and local Docker needs
  admin, so validation was done as read-only production queries instead
  of a seeded staging stack. `rls.test.ts` (integration) still needs a
  local stack to run.

## Follow-up

The function-body rewrite is a partial win (fewer layered calls per
row). The full set-based win (0.33 ms) needs session lists to go through
a SECURITY DEFINER RPC that checks membership once per request instead
of per row, like `get_class_action_counts`. That is a larger app change
across the session list call sites and should be done as its own batch
with `rls.test.ts` passing on a staging stack.
