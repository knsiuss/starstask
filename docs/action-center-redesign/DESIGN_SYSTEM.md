# Action Center Design System

Last updated: 2026-11-04

## Colors

Existing tokens only: `bg-surface`, `text-foreground`, `text-muted-foreground`, `bg-accent`, `bg-accent-soft`, `bg-success-soft`, `bg-warning-soft`, `bg-danger-soft`, `border-border`.

No new colors introduced.

## Typography

- Page title: `text-[26px] sm:text-3xl`
- Section heading: `text-sm` or `text-base`
- Body: `text-sm`
- Metadata: `text-xs` / `text-[11px]`
- Counts: `tabular-nums`

## Spacing

```text
px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8
```

Stat cards: `grid-cols-2 gap-2.5 lg:gap-3`.

## Radii

Cards: `rounded-xl` / `rounded-2xl`.

## Status badges

- Pending: blue (`accent`)
- Approved: green (`success`)
- Rejected: red (`danger`)
- Revision: amber (`warning`)
- Draft/Cancelled: neutral
- Forwarded: green (with distinct label)

## Buttons

Reuse `Button`. Touch targets are 40px+.

## Cards

White surface, subtle border, no heavy shadow. Each class uses one `ClassActionsCard`.

## Tabs

`TabStrip` horizontal; scrolls on overflow.

## Breakpoints

`sm: 640`, `lg: 1024`, `xl: 1280`.

## Shared components

- `TabStrip`
- `Pagination`
- `Card`
- `Badge`
- `AbsenceFilterBar`
- `AbsenceRequestCard`
- `AbsenceDetail`
- `AttendanceTab`
- `LeaveReviewActions`
