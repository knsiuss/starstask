# Trust loop — StarsTask

The public archive is only useful if a wrong brief gets fixed. This document
covers the two mechanisms that close that loop: reader reports and automatic
revision history.

## 1. Report flow

```
Reader                Class admin / platform admin
  │                              │
  ├─ Report a problem ──────────►│  /admin/reports queue
  │   (one open per reader)      │
  │                              ├─ fix the brief (normal edit path)
  │                              └─ resolve or dismiss + note
  │                                          │
  └──────── assignment_reports ◄─────────────┘
```

A report is advisory. It never edits the assignment, so a wrong or malicious
report cannot change published content. The reviewer edits the brief through the
existing assignment path and then closes the report.

### Reasons

| Value               | Label                      |
| ------------------- | -------------------------- |
| `wrong_deadline`    | Deadline is wrong          |
| `wrong_details`     | Details are wrong          |
| `duplicate`         | Duplicate of another brief |
| `broken_attachment` | Attachment does not open   |
| `other`             | Something else             |

The note is optional, but when present it must be 5–2,000 characters. That keeps
"fix it" reports actionable without forcing an essay.

### One open report per reader

A unique partial index on `(assignment_id, reporter_id) WHERE status = 'open'`
means a reader can refine their open report (`report_assignment` upserts) but
cannot stack duplicates. Once the report is `resolved` or `dismissed`, they can
file a new one, which is what lets a reader re-report a regression.

### Who can do what

| Action            | Who                                                        | Enforced by                              |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Read own reports  | Reporter                                                   | `assignment_reports_select` (RLS)        |
| Read class queue  | Class admins, platform admins                              | `can_manage_class(class_id)`             |
| File a report     | Any signed-in user, on a published assignment with a class | `report_assignment`                      |
| Resolve / dismiss | Class admin of that class, platform admin                  | `review_assignment_report` + audit entry |

There is no INSERT/UPDATE/DELETE grant on `assignment_reports`; every write goes
through the two functions. That is what stops a client from resolving its own
report or writing an arbitrary `class_id`.

## 2. Revision history

`record_assignment_revision()` runs after `INSERT` and after any update of
`title`, `description`, `deadline`, `status`, `course_id`, or `class_id`.

- The trigger compares values explicitly, so a no-op update writes no row.
- The snapshot holds only reader-visible fields. It is not a shadow copy of the
  whole row.
- `change_kind` is `created`, `updated`, or `moderated` (any status change).
- There is no UPDATE/DELETE grant. History is append-only by construction.

The assignment detail page renders the newest 20 revisions for the author and
for class/platform managers. RLS returns an empty list for anyone else, so the
section stays hidden instead of revealing that edits happened.

## 3. Why these shapes

**Trigger, not application code.** A revision written by a helper can be skipped
by a future write path. A trigger fires for every writer, including a manual SQL
fix.

**Function-only writes.** Reports are a security boundary: a client must not be
able to attribute a report to another class, or close its own. Keeping the
permission check inside the definer function means the route is only a parser.

**Advisory reports.** Auto-applying a report would let one reader rewrite a
published brief. Resolution stays a human decision with an audit trail.

## 4. Deployment checklist

1. Apply `supabase/migrations/20261029003600_trust_loop.sql` before deploying the
   app. The queue and history queries fail without the tables.
2. Confirm `can_manage_class` exists (it does, from the class functions
   migration); the review function depends on it.
3. Seed nothing. The queue starts empty.
4. Smoke test: report a published assignment as a student, then resolve it as a
   platform admin and confirm the audit entry.

## 5. Not implemented

- No notification to the reporter when a report is resolved. The assignment page
  is the source of truth, and a resolution note is stored for reviewers.
- No automatic duplicate grouping. A `duplicate` report is still a human queue
  item.
- No per-class report metrics or SLA tracking.
