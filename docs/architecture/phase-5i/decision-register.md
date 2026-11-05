# Phase 5I — Decision Register (carried forward + new)

Decisions #1–#12 from phase-5h remain UNRESOLVED/PENDING exactly as recorded; none were settled by this phase. New entries below.

| #     | Decision                                      | Status (2026-11-05)                                                                  | Consequence                                                                                                                                                |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5I-1  | Academic-year creation authority              | DECIDED: platform admin only                                                         | No university-admin delegation exists yet; ordinary users can never create academic periods. Revisit when delegation model lands (#4).                     |
| 5I-2  | University selection UX                       | DECIDED: read-only active-registry browser + guidance                                | Selection persists nothing; no self-service switching/request; non-active rows stay invisible (RLS).                                                       |
| 5I-3  | Platform Admin registry UI                    | BLOCKED (by design)                                                                  | Needs ADR-002 sign-off + additive definer migration or sanctioned service_role read; bypassing RLS is off the table. Until then: operator out-of-band.     |
| 5I-4  | Course invite scope this phase                | DECIDED: list + revoke only, platform-admin                                          | No create/accept/redeem/max-uses; usage policy (#5) still governs everything else.                                                                         |
| 5I-5  | Write path for new domains without write RPCs | DECIDED: service-role after request-scope authz + tenant re-validation + audit       | Never client-exposed; 503 when unconfigured; RLS remains the default boundary.                                                                             |
| 5I-6  | Tenant-unlinked (legacy) classes              | DECIDED: standard "not linked" notice; no NULL-tenant reads                          | New academic surfaces inert until platform links classes; no backfill (#7).                                                                                |
| 5I-7  | Admin presets/groups                          | NOT BUILT                                                                            | Schema stores raw codes only; no preset table; groups documented as future gate.                                                                           |
| 5I-8  | Grading surface                               | DECIDED: read-only batches + ledger; `manage_grades` gate                            | Nothing publishes; no CSV path (#1).                                                                                                                       |
| 5I-9  | Announcement visibility                       | DECIDED: members see published only; managers see all; CRUD via service path + audit | RLS would expose drafts to members; app filters them out.                                                                                                  |
| 5I-10 | Announcement→notification fan-out             | DEFERRED                                                                             | Would risk duplicate delivery with legacy class-post notifications; needs product decision.                                                                |
| 5I-11 | `database.ts` (handwritten) gaps              | PATCHED MINIMALLY                                                                    | Added `has_class_permission`, `is_university_member`, `audit_logs.university_id`, fixed `classes.entry_year` to `number`; noted drift for 5J regeneration. |
| 5I-12 | Attendance export (new model)                 | NOT IMPLEMENTED                                                                      | No sanctioned export path; legacy exports untouched; open question for 5J.                                                                                 |
| 5I-13 | Chat                                          | **NOT IMPLEMENTED**                                                                  | Explicitly out of scope; announcements are not a chat substrate.                                                                                           |

## Carry-forward blockers (unchanged)

1. **#7 / ADR-002** — platform sign-off + legacy registry mapping before any membership/activation; nothing in 5I bypasses this.
2. **#5** — invite usage policy; create/accept blocked.
3. **#1** — grading CSV; verification/publication blocked.
4. **#2** — catalogue scope; offerings unfiltered (ambiguous on purpose).
5. **#3** — discussion scope; `discussion_threads` isolated, zero wiring.
6. **#4** — lecturer roles; `lecturer_name` stays free text; no lecturer RBAC.
7. **#6 / late & attempt policy** — assignments untouched.
8. **#8** — multiple home classes; app never selects one (multi-membership → notice).
9. **#9** — graduated→active reactivation: platform-only via RPC; app exposes status only.
10. **#10** — class-media public visibility; not reviewed; unchanged (do-not-touch).
11. **#11** — chat product definition; absent.
12. **WIP migration** `20261110000000_subject_enrollment.sql` — SHA-256 `59CE5DAF…ECEC3`; never executed; excluded from anything 5I did.
