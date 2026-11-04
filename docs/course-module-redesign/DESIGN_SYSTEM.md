# Course Module Design System

Last updated: 2026-11-04

## Colors

Existing tokens only:

| Role                 | Token                                               |
| -------------------- | --------------------------------------------------- |
| Page background      | `bg-[var(--color-band)]` / existing page background |
| Surface              | `bg-surface`                                        |
| Primary text         | `text-foreground`                                   |
| Secondary text       | `text-muted-foreground`                             |
| Primary action       | `bg-accent` / `text-accent`                         |
| Soft blue background | `bg-accent-soft`                                    |
| Success              | `bg-success-soft` / `text-success`                  |
| Warning              | `bg-warning-soft` / `text-warning`                  |
| Error                | `text-danger` / `bg-danger-soft`                    |
| Border               | `border-border`                                     |

No purple, neon, or decorative gradients added.

## Typography

- Page title: `text-[26px] sm:text-3xl` / `text-2xl` depending on page.
- Section heading: `text-sm font-semibold` or `text-base font-semibold`.
- Body copy: `text-sm`.
- Metadata: `text-xs`.
- Tabular numerics: `tabular-nums` for counts and deadlines.

## Spacing

Course pages use:

```text
px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8
```

Sections vertically separate with `gap-4 sm:gap-6` on mobile and `gap-5` on desktop.

## Radii

- Cards: `rounded-xl`
- Pills: `rounded-lg` / `rounded-full`
- Inputs: `rounded-xl` where existing components define them

## Buttons

Reuse `Button` from `@/components/ui/button`.
Touch targets remain at least 40–44px high on mobile.
No new button variants introduced.

## Cards

- White/surface card, `border`, `rounded-xl`, subtle border, no heavy shadow.
- Section headers are plain, not oversized nested cards.

## Forms

- Mobile: single-column inputs by default; existing two-column desktop grids kept where they already work.
- Labels remain visible; required fields marked.
- Validation errors are announced inline.
- Existing validation logic and schemas are unchanged.

## Responsive breakpoints

Same as the rest of the app:

```text
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

Course Overview uses `lg` for the two-column desktop split.

## Shared components

Existing shared components reused:

- `CourseWorkspaceHeader`
- `CourseWorkspaceTabs`
- `StatusBadge`
- `CourseOverviewStats` (implemented in `course-overview.tsx`)
- `SectionCard`, `SideCard`, `InfoRow`
- `AssignmentControls`
- `Button`, `Input`, `Select`, `Textarea`, `Badge`

## Mobile-only hiding

Items hidden on mobile because the same destination is reachable from navigation:

- Course Overview → "Quick links" aside
- Course Overview → "Recently published materials"
- Course Overview → "Recent course activity"

Desktop shows all of these.
