# Course Module Route Inventory

Last updated: 2026-11-04

## Scope

The Course Module is every route under a class group that renders course-specific
content. Assignment detail and assignment edit pages are shared with the global
assignments module; they are listed here because they participate in the course
workflow, but they are not course-specific layouts.

## Routes

| Route                                                        | Purpose                             | Main components                                                                       | Changes made                                                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard/classes/[slug]/courses`                          | List all courses in a class         | `CoursesPage` (server), `ClassWorkspaceTabs`, `CreateSubjectForm`                     | Compact mobile page padding                                                                                                                                        |
| `/dashboard/classes/[slug]/courses/[courseId]`               | Course Overview                     | `CourseWorkspaceHeader`, `CourseOverviewStats`, `CourseOverview`, `ClassSubjectView`  | Added exact published-count stats strip; mobile section order corrected; Quick Links and Recently Published Materials hidden on mobile; desktop sidebars preserved |
| `/dashboard/classes/[slug]/courses/[courseId]/assignments`   | Course assignments list             | `CourseWorkspaceHeader`, `AssignmentControls`, `AssignmentRow`, `AssignmentRowMenu`   | Compact mobile page padding; search and compact filters kept visible (spec requires them)                                                                          |
| `/dashboard/classes/[slug]/courses/[courseId]/materials`     | Course materials list + upload/edit | `CourseWorkspaceHeader`, `CourseMaterials`                                            | Compact mobile page padding                                                                                                                                        |
| `/dashboard/classes/[slug]/courses/[courseId]/announcements` | Course announcements list           | `CourseWorkspaceHeader`, announcement list rows                                       | Compact mobile page padding; compact announcement empty state                                                                                                      |
| `/dashboard/classes/[slug]/courses/[courseId]/members`       | Course members                      | `CourseWorkspaceHeader`, member list rows                                             | Compact mobile page padding                                                                                                                                        |
| `/dashboard/classes/[slug]/courses/[courseId]/schedule`      | Course schedule                     | `CourseWorkspaceHeader`                                                               | Compact mobile page padding                                                                                                                                        |
| `/dashboard/classes/[slug]/courses/[courseId]/attendance`    | Course attendance                   | `CourseWorkspaceHeader`                                                               | Compact mobile page padding                                                                                                                                        |
| `/dashboard/classes/[slug]/courses/[courseId]/settings`      | Course settings                     | `CourseWorkspaceHeader`, `CourseSettingsForm`                                         | Compact mobile page padding                                                                                                                                        |
| `/assignments/[id]`                                          | Assignment detail                   | `AssignmentContentTypeBadge`, `AttachmentList`, `AssignmentHistory`, `MyReportStatus` | Inspected, no changes                                                                                                                                              |
| `/assignments/[id]/edit`                                     | Edit assignment                     | Assignment edit page                                                                  | Inspected, no changes                                                                                                                                              |

## Shared course chrome

| Component               | Role                                            | Changes made                                                                                                                                  |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `CourseWorkspaceHeader` | Breadcrumb, course title, status, actions, tabs | Inspected; no structural changes                                                                                                              |
| `CourseWorkspaceTabs`   | Horizontal tab strip                            | Inspected; no changes                                                                                                                         |
| `AssignmentControls`    | Search + status/sort dropdowns                  | Kept visible on mobile after Course Module spec required search and compact filters; earlier hide-on-mobile edit was reverted for this module |
| `CourseOverview`        | Overview composition                            | Reordered mobile sections; stats strip; hid mobile-only sections; title wraps                                                                 |

## 404 / error states

`loading.tsx`, `error.tsx`, `not-found.tsx` for `[courseId]` were inspected in
inventory and left unchanged.
