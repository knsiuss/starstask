# Class Module Mobile Layout Spec

Last updated: 2026-11-04

## Global rules

- No horizontal overflow.
- Section order is explicit on mobile with `order-*` classes.
- Long text wraps; no unnecessary `truncate`.
- Empty states are compact.
- Touch targets are at least 40px high.
- No competing navigation systems.

## My Classes

Order:

1. Title + description
2. Join a Class
3. Class count + grid/list toggle
4. Class list

Filter panel is hidden on mobile; desktop keeps search, status, year, semester, sorting.

## Class Detail

Order:

1. Breadcrumb
2. Class identity header
3. Class actions
4. Class tabs
5. Tab content

## Class Overview

Order on mobile:

1. Class Overview (stats)
2. Class Quick Actions
3. Recent Assignments
4. Your Posts

Desktop keeps the 2-column layout.

## Members

Compact rows. Admins first. Role badges visible. Manage actions (admins only) sit in the header area; the More menu keeps other actions.

## Courses (class tab)

Compact list of courses. Header with Create action (admins) or empty state. Course cards link to the course detail page.

## Assignments (class tab)

Compact list with deadline and status badges. A subject filter select sits above the list. Pagination at the bottom.

## Schedule

The existing schedule tab is rendered as a responsive calendar; mobile uses the list variant. Creation and editing remain available to authorized users.

## Attendance

Meeting form has two-column fields on mobile (meeting number + date, lat/lng). Location section is collapsible with Configured/Not set chip. The full-width Create button prevents duplicate submits. Overview and Export are hidden on mobile.

## Announcements / Materials

Announcements use a compact feed. Materials rows are compact; upload/edit forms are single-column, validated by the existing schemas.

## Settings / Manage

Admin-only. Manage page has tabs for overview, members, invites, courses, content, settings. Settings form groups fields logically; validation unchanged.

## Leave requests / Reports / Sessions / Review

Inspected; no changes applied. All use the shared class chrome and standard padding.
