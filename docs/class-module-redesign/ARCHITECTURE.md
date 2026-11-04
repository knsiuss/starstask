# Class Module Architecture

Last updated: 2026-11-04

## Page hierarchy

```mermaid
flowchart TD
  A["/classes"] --> B["My Classes"]
  A --> C["/classes/join"]
  B --> D["/dashboard/classes/[slug]"]
  D --> E["overview"]
  D --> F["courses"]
  D --> G["assignments"]
  D --> H["members"]
  D --> I["schedule"]
  D --> J["attendance"]
  D --> K["info"]
  D --> L["manage"]
  L --> M["overview"]
  L --> N["members"]
  L --> O["invites"]
  L --> P["courses"]
  L --> Q["content"]
  L --> R["settings"]
  D --> S["sessions"]
  D --> T["leave-requests"]
  D --> U["reports"]
  D --> V["review/[id]"]
  D --> W["submit"]
  D --> X["submissions/[id]/revise"]
```

## Shared chrome

```mermaid
flowchart LR
  page["Server page (class)"] --> header["ClassIdentityHeader"]
  header --> actions["ClassWorkspaceActions"]
  header --> tabs["ClassWorkspaceTabs"]
  page --> tabContent["Tab content"]
  tabContent --> ui["Shared UI components"]
```

## Role-based UI

```mermaid
flowchart TD
  A["getClassRole"] --> B{"isAdmin?"}
  B -- yes --> C["Manage class, review queue, settings, create assignment"]
  B -- no --> D["View info, request publication, leave request"]
  C --> E["Server re-checks authorization"]
  D --> E
```

Class Admin is class-scoped. The frontend never enforces security alone; RLS and server checks are the boundary.

## Responsive layout strategy

- `contents xl:*` wrappers make the two-column desktop layout collapse into one ordered mobile column.
- No client-side layout branching; CSS only.
- Data fetching happens once per server page.

## Navigation

```mermaid
flowchart LR
  a["Global bottom nav"] --> b["Dashboard"]
  a --> c["Assignments"]
  a --> d["Attendance"]
  a --> e["Schedule"]
  a --> f["Absence"]
  b --> g["/classes"]
  g --> h["My Classes"]
  h --> i["Class workspace"]
  i --> j["Course workspace"]
```

## Workflows

- Create assignment: class tab → submit.
- Attendance: class tab → attendance workspace → meeting form.
- Schedule: class tab → schedule tab → create entry.
- Members/invites: manage tab → members/invites.
- Leave requests: class tab → leave requests.
- Review: manage content → review queue.
