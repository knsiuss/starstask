# Mobile Layout Spec — Course Module

Last updated: 2026-11-04

## Global rules

- No horizontal overflow.
- Section order is explicit on mobile using `order-*` inside `contents lg:*` wrappers.
- Long text wraps; titles do not truncate when wrapping is better.
- Empty states are compact (`py-8` instead of `py-12`).
- Touch targets stay at least 40–44px high.
- Bottom navigation is not covered by sticky elements placed inside course pages.

## Course Overview

Order on mobile:

1. CourseWorkspaceHeader (breadcrumb, course title, actions, tabs)
2. Course Overview (stats strip)
3. Course Information
4. Upcoming Assignments
5. Recent Announcements

Desktop keeps the previous two-column composition; the stats strip spans full width above it.

## Course Assignments

Order:

1. Header
2. Search + Status + Sort (AssignmentControls)
3. Assignment list
4. Back to course overview

Filters are compact; they do not expand into a full panel.

## Materials

Order:

1. Header
2. "Learning materials" intro
3. Add material action / form (when permitted)
4. Material list

List rows remain compact; descriptions wrap with `whitespace-pre-line`.

## Announcements

Order:

1. Header
2. Title, count, Post announcement action (when permitted)
3. Announcement list

Announcements use a compact chronological list. Admin/Edit/Review actions stay visible for authorized users.

## Details and forms

- Assignment detail and edit pages were inspected; no layout changes were applied because they already follow the shared card and form patterns.
- Course settings, materials form, and create/edit dialogs keep existing validation and permissions.

## Hidden on mobile in Course Overview

The following are hidden only on mobile and remain on desktop:

- Quick links
- Recently published materials
- Recent course activity
