# Phase 5H — Decision Register (unresolved business decisions)

| #   | Decision                                                     | Status                                                  | Impact                                                                                                |
| --- | ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Grading CSV column mapping                                   | UNRESOLVED                                              | Blocks grade import/verification UI path                                                              |
| 2   | Course catalogue scope (global vs per-university)            | UNRESOLVED (stays nullable on `courses.university_id`)  | Blocks per-tenant catalogue isolation; existing courses stay global                                   |
| 3   | Discussion scope (class vs offering)                         | UNRESOLVED                                              | `discussion_threads` must remain isolated; no publishing                                              |
| 4   | Lecturer roles & assignments                                 | UNRESOLVED                                              | `course_offerings.lecturer_name` is free text today; no lecturer RBAC                                 |
| 5   | Invite usage policy (single-use? max uses? expiry defaults?) | UNRESOLVED                                              | `course_invite_tokens` has no usable creation/redemption flow; invitation UX blocked                  |
| 6   | Late-submission + attempt policy                             | UNRESOLVED                                              | Assignments unchanged; storage/submissions unchanged                                                  |
| 7   | Platform registry mapping/activation for legacy users        | UNRESOLVED                                              | No backfill to `university_memberships`; onboarding still writes free-text `profiles.university` only |
| 8   | Multiple home classes                                        | UNRESOLVED (DB currently enforces one per identity)     | Product must decide                                                                                   |
| 9   | reactivation edge cases (`graduated`→`active`)               | UNRESOLVED                                              | Lifecycle rules incomplete                                                                            |
| 10  | class-media public visibility intent                         | UNRESOLVED                                              | Storage bucket stays public; not reviewed for brand/legal risk                                        |
| 11  | Chat product definition (DMs, groups, receipts)              | UNRESOLVED / **NOT IMPLEMENTED**                        | Entire chat domain absent from repo                                                                   |
| 12  | ADR-002 (single-table registry)                              | **IMPLEMENTATION-JUSTIFIED, PENDING PLATFORM SIGN-OFF** | Production registry activation blocked until explicit approval                                        |

## Decision-gate consequences

- No backfill, no activation, no membership auto-creation until #7 approved.
- Any "accept invitation" flow until #5 is a fabrication of business rules — must not ship.
- Any grade publishing until #1 is approved contradicts the verification requirement.
- `discussion_threads` and social feed remain untouched product-wise.

## Approval blocks (critical path)

A. Platform Admin sign-off for ADR-002 + backfill of existing users (#7).
B. Product decision on #5 (invite policy) and #1 (CSV columns).
C. Decision on #11 whether chat exists in scope at all.
