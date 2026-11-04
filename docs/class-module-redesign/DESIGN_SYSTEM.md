# Class Module Design System

Last updated: 2026-11-04

## Colors

Existing tokens only:

| Role            | Token                              |
| --------------- | ---------------------------------- |
| Page background | `bg-[var(--color-band)]`           |
| Surface         | `bg-surface`                       |
| Primary text    | `text-foreground`                  |
| Secondary text  | `text-muted-foreground`            |
| Primary action  | `bg-accent` / `text-accent`        |
| Soft blue       | `bg-accent-soft`                   |
| Success         | `bg-success-soft` / `text-success` |
| Warning         | `bg-warning-soft` / `text-warning` |
| Danger          | `bg-danger-soft` / `text-danger`   |
| Border          | `border-border`                    |

No purple or neon colors added.

## Typography

- Page title: `text-xl sm:text-3xl`
- Section heading: `text-sm` or `text-base font-semibold`
- Body: `text-sm`
- Metadata: `text-xs`
- Counts: `tabular-nums`

## Spacing

Course pages and class pages use:

```text
px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8
```

Sections separated with `gap-4 sm:gap-6` on mobile.

## Radii

- Cards: `rounded-xl` / `rounded-2xl`
- Pills: `rounded-lg` / `rounded-full`
- Inputs: `rounded-xl` where existing components define them

## Buttons

Reuse `Button` from `@/components/ui/button`. Touch targets are at least 40–44px.

## Cards

White surface, subtle border, no heavy shadow. Section headers use plain text, not oversized nested cards.

## Tabs

- Horizontal strip; scrolls when needed.
- Active tab has blue accent.
- 40px+ touch height.

## Forms

- Single column on mobile.
- Labels visible; required fields marked.
- Existing validation messages shown inline.

## Breakpoints

```text
sm: 640px
md: 768px
lg: 1024px (desktop splits)
xl: 1280px
```

Mobile section order is controlled with `order-*` inside `contents xl:*` wrappers.

## Shared class components

- `ClassIdentityHeader`
- `ClassWorkspaceActions`
- `ClassWorkspaceTabs`
- `OverviewStats`
- `ClassQuickActions`
- `RecentAssignments`
- `YourPosts`
- `ClassMembersTab`
- `ClassInfoTab`
- `ClassAssignmentsTab`
- `ClassScheduleTab`
