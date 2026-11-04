# Action Center Architecture

Last updated: 2026-11-04

## Page hierarchy

```mermaid
flowchart TD
  A["/dashboard/actions"] --> B["overview"]
  A --> C["assignments"]
  A --> D["absences"]
  A --> E["attendance"]
  D --> F["absence detail"]
```

## Request categories

```mermaid
flowchart LR
  A["Action Center"] --> B["Assignment publication"]
  A --> C["Absence request"]
  A --> D["Attendance sessions"]
  A --> E["Open reports"]
```

## Lifecycles

```mermaid
flowchart LR
  A["Assignment request"] --> B["pending"]
  B --> C["approved"]
  B --> D["rejected"]
  B --> E["revision"]

  F["Absence request"] --> G["submitted"]
  G --> H["approved"]
  G --> I["rejected"]
  G --> J["revision"]
  G --> K["forwarded"]
  G --> L["cancelled"]
```

## Role-based access

```mermaid
flowchart TD
  A["getSessionUser"] --> B["getWorkspaceScope"]
  B --> C["getClassActionCenter"]
  C --> D{"is_admin && active"}
  D -- yes --> E["show class in action center"]
  D -- no --> F["exclude"]
```

## Responsive strategy

- Single server page; tabs rendered from URL params.
- Mobile order via CSS only; no client branching.
- Lists wrap; no table overflow.

## Shared components

```mermaid
flowchart LR
  page["Server page"] --> tabstrip["TabStrip"]
  page --> absences["AbsenceFilterBar"]
  page --> cards["AbsenceRequestCard"]
  page --> detail["AbsenceDetail"]
  page --> attendance["AttendanceTab"]
  detail --> actions["LeaveReviewActions"]
```

## Data fetching

- One server request per tab; independent tabs do not refetch when inactive.
