# Lecturer Role & Automated Academic Validation — StarsTask

This document defines the Lecturer role scope, role-aware navigation and page
boundaries, and the Automated Academic Validation Engine in StarsTask. It also
documents how these rules map onto StarsTask's existing architecture and where
StarsTask intentionally stops short of a full campus SIAKAD/KRS system.

> Status: architecture and implementation specification aligned with
> `docs/ARCHITECTURE.md` and `docs/CLASSES.md`. Role separation and core
> validation rules are enforced across `@starstask/contracts`, Next.js server
> boundaries, and Supabase PostgreSQL RLS/RPCs.

## Table of contents

- [1. Lecturer role scope and access control](#1-lecturer-role-scope-and-access-control)
- [2. Role-aware navigation and page surfaces](#2-role-aware-navigation-and-page-surfaces)
- [3. Automated Academic Validation Engine](#3-automated-academic-validation-engine)
- [4. Five-layer technical architecture](#4-five-layer-technical-architecture)
- [5. Boundaries vs. full SIAKAD/KRS and future roadmap](#5-boundaries-vs-full-siakadkrs-and-future-roadmap)

## 1. Lecturer role scope and access control

A lecturer in StarsTask is an academic instructor who manages teaching
sessions, class rosters, attendance, leave reviews, and coursework evaluation.
Because a lecturer may also be enrolled in another class or testing student
flows, the role boundary separates default workspace presentation from
server-side authorization.

### Server-side enforcement

UI navigation flags are strictly cosmetic. Every protected route, server
component, Route Handler, and database mutation enforces authorization on the
server:

1. **Persona check (`is_lecturer()`)**: Backed by the `SECURITY DEFINER`
   function `public.is_lecturer(p_university_id uuid DEFAULT NULL)` (defined in
   `supabase/migrations/20270114000000_university_roles.sql`) and cached per
   request in `apps/web/src/lib/auth/lecturer.ts`. It returns `true` only when
   the authenticated `auth.uid()` holds an active `lecturer` (or
   `university_admin`) persona. It fails closed (`false`) on error or missing
   configuration.
2. **Class-scoped authority (`class_admins`)**: Having a lecturer persona does
   not grant access to every class on the platform. Class management, session
   creation, attendance management, leave review, and grading require
   membership in `class_admins` for the target `class_id` (or Platform Admin
   privilege where applicable, see `docs/CLASSES.md`).
3. **Row-Level Security (RLS)**: All queries through user-scoped Supabase
   clients (`apps/web/src/lib/db/*`) remain subject to Postgres RLS policies.
   State-mutating RPCs re-verify `auth.uid()` and role membership inside the
   transaction.

### Escape hatch (`/app?view=student`)

By default, an authenticated lecturer hitting `/app` is redirected to
`/lecturer` (`apps/web/src/app/(workspace)/app/page.tsx`). If a lecturer needs
to access the student dashboard (for example, when enrolled as a participant in
another class), `/app?view=student` bypasses the redirect while keeping
server-side class and role checks intact.

## 2. Role-aware navigation and page surfaces

When `isLecturer()` resolves to `true`, the workspace shell removes the default
student `"My studies"` section from the sidebar and renders lecturer-first
destinations (`apps/web/src/components/layout/workspace-nav-items.ts`,
`workspace-nav.tsx`, and `mobile-tab-bar.tsx`).

### Lecturer vs. student surface matrix

| Surface / Route                        | Lecturer Experience                                                                        | Student Experience                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `/lecturer` (`Teaching home`)          | Default landing console: administered classes, roster counts, teaching realization tracker | Redirected or denied if not a lecturer                |
| `/actions` (`Action center`)           | Pending reviews, class approvals, and moderation tasks                                     | Visible only to student class admins (`LEADER_ITEMS`) |
| `/classes` (`Classes`)                 | Classes administered or joined, course management, materials                               | Enrolled classes and discovery                        |
| `/schedule` (`Schedule`)               | Teaching timetable across administered classes with collision validation                   | Personal class and session timetable                  |
| `/attendance` (`Attendance`)           | Class attendance management, open/close sessions, BAP entry, rekap                         | Self check-in and personal attendance log             |
| `/leave-requests` (`Absence requests`) | Review, approve, or reject student leave requests and evidence                             | Submit leave requests and upload evidence             |
| `/university-info` (`Campus`)          | Shown only when campus integration is active (e.g., onboarding validation)                 | Shown only when campus integration is active          |
| `/assignments` & `"My studies"`        | Hidden from default lecturer nav; reachable via `/app?view=student`                        | Primary feed for public and class assignments         |

### Role-aware shared routes

Shared routes (`/attendance`, `/leave-requests`, and `/schedule`) branch on the
server using `isLecturer()` and `class_admins` context:

- **`/attendance`**: Lecturers see session controls, class attendance rosters,
  BAP topic completion, and 75% eligibility indicators instead of the student
  check-in form.
- **`/leave-requests`**: Lecturers see pending student absence requests for
  their classes with private signed-URL evidence previews and approve/reject
  actions instead of the student submission form.
- **`/schedule`**: Lecturers see their teaching schedule across courses and
  classes, with overlap detection when adding or editing slots.

## 3. Automated Academic Validation Engine

The validation engine prevents invalid academic state before it reaches the
database. It is structured around four operational pillars mapped directly to
StarsTask's data model.

### Pillar 1: Schedule and time-slot collision

- **Scope**: `class_course_schedules` (recurring weekly slots with
  `day_of_week`, `start_time`, `end_time`, `room`, `lecturer_name`, `start_date`,
  and `end_date`).
- **Overlap rule**: Two slots on the same `day_of_week` (within overlapping
  semester date ranges, when present) collide when:

```text
new_start_time < existing_end_time AND new_end_time > existing_start_time
```

- **Checks**:
  - Time window sanity: `end_time > start_time` (enforced in Zod and DB check
    constraint `class_course_schedules_time_window`).
  - Class/lecturer/room conflict detection before inserting or updating a slot.
- **Roadmap note**: Cross-university KRS credit limits (SKS), prerequisite
  checks, and distributed row-locking across concurrent student enrollments are
  out of scope for the current phase (see Section 5).

### Pillar 2: Attendance validation

- **Auto-cutoff (15-minute window)**: When an `attendance_meetings` session
  passes its scheduled cutoff window without a check-in, students without a
  record are automatically marked `absent`, unless they hold an approved
  `leave_requests` entry covering that session (which resolves to `excused`).
- **75% exam eligibility rule**: Attendance eligibility is computed per student
  per course offering as `attended_or_excused / total_held_meetings`. Students
  falling below `75%` are flagged with an eligibility warning indicator in the
  lecturer attendance recap and export views.
- **Check-in integrity (optional extensions)**: Session check-ins may be
  hardened with rotating dynamic QR tokens or campus geofence radius checks
  configured per offering without altering the core attendance state machine.

### Pillar 3: Assignments and grading sanity checks

- **Weight sum validation**: Assessment component weights within a course
  grading configuration must sum to exactly `100%` (`total_weight === 100`)
  before publishing or finalizing grades.
- **Score range validation**: Every numeric grade entry is bounded to `0–100`
  (`0 <= score <= 100`) in both `@starstask/contracts` and database
  constraints.
- **Submission and file validation**: Uploads enforce extension allowlists,
  content-length limits, and magic-byte signature verification (never trusting
  client-declared MIME types), storing files in private Supabase Storage
  buckets with short-lived signed URLs.
- **Roadmap note**: Automated plagiarism/similarity scoring and isolated
  Docker/Judge0 code-execution sandboxes are deferred to a future phase.

### Pillar 4: Lecturer teaching realization (BAP and LKD)

- **BAP (Berita Acara Perkuliahan) gate**: Closing an `attendance_meetings`
  session requires non-empty teaching topic/notes (`BAP` summary) so every
  completed meeting has an auditable academic record.
- **Meeting count tracker (14–16 target)**: Each course offering tracks held
  meetings against the standard semester target (`14–16` meetings). The
  `/lecturer` console surfaces progress and flags courses falling behind pace
  so lecturers can schedule makeup sessions.

## 4. Five-layer technical architecture

StarsTask implements the validation engine across five distinct layers without
introducing external microservices:

| Layer                                    | StarsTask Location                         | Responsibility                                                                                                       |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1. Presentation & Route Guards           | `apps/web/src/app/**`, `src/components/**` | Role-aware rendering (`isLecturer()`), `/app?view=student` escape hatch, inline form feedback. No SQL in components. |
| 2. Schema & API Contracts                | `packages/contracts/src/*.ts`              | Shared `Zod` schemas for schedules, attendance meetings, BAP notes, leave requests, and grade weights/ranges.        |
| 3. State Machine & Domain Orchestration  | `apps/web/src/features/**`, Route Handlers | Multi-step workflows (e.g., upload -> DB -> rollback), rate limiting, and atomic state transitions.                  |
| 4. Database Constraints, Triggers & RPCs | `supabase/migrations/*.sql`                | `CHECK` constraints, partial unique indexes, `SECURITY DEFINER` RPCs (`auth.uid()` checks), and RLS policies.        |
| 5. Async & Time-Based Jobs               | `pg_cron` / `/api/cron/*`                  | Scheduled auto-cutoff for expired attendance windows, deadline reminders, and makeup-class alerts.                   |

### Defense-in-depth flow

```text
Client Form (UI hints)
  │
  ▼
Next.js Route Handler / Server Component
  ├─ Session + isLecturer() / class_admins pre-check
  └─ Zod schema parse (@starstask/contracts) ──► 422 fieldErrors
        │
        ▼
Supabase PostgreSQL (SECURITY DEFINER RPC / RLS)
  ├─ Re-verify auth.uid() & role inside transaction
  ├─ Enforce CHECK constraints & overlap / sum = 100% rules
  └─ Write state change + audit_logs + notification_events
```

## 5. Boundaries vs. full SIAKAD/KRS and future roadmap

StarsTask is a teaching, assignment, attendance, and class-coordination
platform. It is **not** a replacement for a university's core academic
information system (SIAKAD/KRS).

### Explicitly out of scope (current phase)

- **KRS / enrollment engine**: Course registration carts, SKS credit-load
  caps based on prior-semester IPS/IPK, and prerequisite graph enforcement.
- **High-concurrency seat locking**: Distributed `SELECT ... FOR UPDATE`
  seat-quota reservation during campus-wide KRS war windows.
- **Code-execution sandbox**: Isolated Docker or Judge0 runners for automated
  programming assignment grading.
- **Plagiarism / similarity engine**: Cross-submission AST or text-similarity
  indexing.

### Planned future phases

1. **Academic integration adapters**: Read-only roster and schedule sync from
   institutional SIAKAD feeds into `classes`, `class_subjects`, and
   `class_course_schedules`.
2. **Dynamic verification extensions**: Opt-in rotating QR codes and campus
   geofence verification for in-person `attendance_meetings`.
3. **Automated grading pipelines**: Sandboxed test runners and similarity
   checks attached to `assignments` as asynchronous worker jobs.

## 6. Local lecturer testing setup

Because StarsTask signs users in with Google OAuth in production and hosted
environments, local UI and integration testing uses the local Supabase stack
(`127.0.0.1:54321`) and disposable test accounts rather than bypassing OAuth.

- **Local test lecturer account**: `lecturer-test@example.test` (seeded in the
  local Docker Supabase stack with an active `university_memberships` row
  `role = 'lecturer'` and `onboarded_at` set).
- **Required local environment variables** (values obtained from
  `npx supabase status -o env`, never committed to Git):
  - `E2E_SUPABASE_URL` (`http://127.0.0.1:54321`)
  - `E2E_SUPABASE_ANON_KEY`
  - `E2E_SUPABASE_SERVICE_ROLE_KEY`
- **Running Playwright visual/E2E verification**:
  - Use `apps/web/tests/e2e/support/local-supabase.ts` (`createE2eUser` +
    `signInBrowser`) which signs in via `signInWithPassword` against
    `127.0.0.1:54321` and writes the `@supabase/ssr` session cookie into the
    Playwright browser context.
  - Run `pnpm --filter @starstask/web test:e2e -- tests/e2e/dashboard-visual.spec.ts`
    with `E2E_SUPABASE_*` set to inspect rendered screenshots in
    `apps/web/test-results/app-shots/`.
