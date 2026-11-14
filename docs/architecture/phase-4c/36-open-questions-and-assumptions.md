# 36 — Open Questions & Assumptions

> Every unresolved item from the brief, classified.

| #   | Question                                                             | Classification                        | Owner / needed input                           |
| --- | -------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| 1   | Grading CSV format (columns, score scale)                            | **UNRESOLVED**                        | Sample CSV from class admin                    |
| 2   | Course catalogue scope: global or per-university?                    | **UNRESOLVED**                        | Product decision                               |
| 3   | Social feed + discussions confirmation                               | **UNRESOLVED** (candidate)            | Product decision                               |
| 4   | Lecturer roles (confirmed as extensible-only — what triggers build?) | **UNRESOLVED**                        | Product decision                               |
| 5   | Attendance status enum authoritative list                            | **UNRESOLVED** (candidates only)      | Read `20261101090000` + `20261107000000` in 5A |
| 6   | Multi-meeting sessions vs one-meeting-per-session                    | **UNRESOLVED**                        | Product/department confirmation                |
| 7   | `profiles.university` → registry mapping (fuzzy strings)             | **UNRESOLVED**                        | Platform Admin review                          |
| 8   | Course invite default usage policy (10/30-day)                       | **RECOMMENDED** (needs sign-off)      | Owner approval                                 |
| 9   | Entry Year backfill source for legacy classes                        | **UNRESOLVED**                        | Parse `home_code` best-effort + review         |
| 10  | Class-media storage policy confirmation                              | **UNRESOLVED**                        | Grep `20261102100000`                          |
| 11  | `rls_auto_enable` presence + grant strategy in prod                  | **REPORTED** (needs 5A)               | Staging catalog                                |
| 12  | Live sizes/rows/seq-scans                                            | **REPORTED** (needs 5A)               | Catalog queries                                |
| 13  | Assumed SQL types (uuid/text/numeric/timestamptz)                    | **ASSUMED** from existing DDL pattern | Confirm per-column in 5A                       |
| 14  | Retention windows (90/180d/3y)                                       | **RECOMMENDED**                       | Owner sign-off                                 |
| 15  | Backup/PITR/restore timing                                           | **UNKNOWN**                           | Staging restore rehearsal                      |

## Assumptions (explicit)

- **ASSUMED:** Generated types at `database.generated.ts` reflect production shape (diff note in `03` found none; production-only `rls_auto_enable` exception REPORTED).
- **ASSUMED:** "52 tables" means `public` tables only (excludes `auth.users`, storage objects).
- **ASSUMED:** Attendance export is Excel/PDF-generate (VERIFIED files) and Excel import is absent per CONFIRMED brief.
- **ASSUMED:** No live DB access means all performance numbers stay REPORTED until 5A.
