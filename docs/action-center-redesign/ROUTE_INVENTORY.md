# Action Center Route Inventory

Last updated: 2026-11-04

## Scope

Action Center = `/dashboard/actions` (single page, four tabs).

## Routes

| Route                                          | Purpose                                           | Main components                                               | Changes made                                                             |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/dashboard/actions` (tab=overview)            | Pending summary + recent requests + class actions | `OverviewTab`, `ClassActionsCard`, `RecentRequestItem` list   | Compact mobile padding; title 26px; stats gap tightened; no logic change |
| `/dashboard/actions?tab=assignments`           | Assignment publication requests                   | `AssignmentsTab` (in page file)                               | Inspected, no changes                                                    |
| `/dashboard/actions?tab=absences`              | Absence requests                                  | `AbsenceFilterBar`, `AbsenceRequestCard`, `AbsenceEmptyState` | Inspected, no changes                                                    |
| `/dashboard/actions?tab=absences&request=[id]` | Absence detail                                    | `AbsenceDetail`, `LeaveReviewActions`, `LeaveHistory`         | Inspected, no changes                                                    |
| `/dashboard/actions?tab=attendance`            | Attendance overview + export                      | `AttendanceTab`                                               | Inspected, no changes                                                    |

## Request types

| Type                   | Source                        | Actions                                           |
| ---------------------- | ----------------------------- | ------------------------------------------------- |
| Assignment publication | `listManagedRequests`         | Review (approve/reject/revision), open assignment |
| Absence request        | `listManagedLeaveRequests`    | Approve/reject, forward, view evidence            |
| Attendance session     | `listClassAttendanceMeetings` | View, Export                                      |
| Open reports           | `ActionCounts.openReports`    | Open report (count only)                          |

## Components

| Component            | Role                                           | Changes made         |
| -------------------- | ---------------------------------------------- | -------------------- |
| `OverviewTab`        | 4 stat cards + recent requests + class sidebar | Compact gaps/padding |
| `ClassActionsCard`   | Per-class metrics                              | Inspected            |
| `AssignmentsTab`     | Filtered request list                          | Inspected            |
| `AbsenceFilterBar`   | GET filter form                                | Inspected            |
| `AbsenceRequestCard` | Request row                                    | Inspected            |
| `AbsenceDetail`      | Sections A–E review UI                         | Inspected            |
| `AttendanceTab`      | Class selector + per-course metrics            | Inspected            |
| `LeaveReviewActions` | Approve / Reject / Forward                     | Inspected            |
