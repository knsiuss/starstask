# Current Architecture (AS-IS)

Purpose: verified existing architecture at audit time. Everything below is read from files in this audit session; unknowns are labelled as open questions, not assumed.

## Stack (verified `apps/web/package.json`)

- Next.js **16.4.3** App Router, React **19.3.1**, TypeScript **5.9.3**
- `@supabase/ssr` 0.12.7 + `@supabase/supabase-js` 2.118.0
- `@upstash/redis` 1.40.0 + `@upstash/ratelimit` 2.2.0
- Document pipelines: `exceljs` 4.4.0, `jszip` 3.10.2, `pdf-lib` 1.17.1, `unpdf` 2.0.0
- `web-push` 3.6.7, `zod` 4.6.7, `lucide-react`, `clsx`/`cva`/`tailwind-merge`, `@radix-ui/*` dialogs
- Dev: vitest 5.0.5, @playwright/test 1.64.1, eslint 9.39.5, tailwindcss 4.3.3

## Pattern (verified)

- Server Components by default; client components (`"use client"`) only where interaction needed (e.g., `class-attendance-workspace.tsx`, `attendance-meeting-form.tsx`, `class-attendance-history-table.tsx` — since removed from class workspace but file deleted, detail panels via `workspace-panel-stack.tsx`).
- Data access exclusively via `lib/db/*` modules and Supabase client; Zod validation at boundaries (`packages/contracts/*`).
- Auth: Supabase Auth email/password (Google via platform provider path in UI), `@supabase/ssr` cookie session; server-side session resolution in `(workspace)/layout.tsx`.
- Authorization: class-scoped role checks (`getClassRole`, `can_manage_class`, `role.isMember/isAdmin/canManage`) plus RLS policies in `supabase/migrations/*`; RPCs e.g. `review_class_assignment`, `review_leave_request` (self-review blocked, `record_audit`, notifications).
- Crons: 2 entries in `apps/web/vercel.json`; 3 more cron routes exist without vercel.json entries (mechanism unverified).
- Storage: Supabase Storage buckets; files read via signed URLs per operation (assignment attachments, leave evidence, materials, media, avatars, exports).
- Integrations: Google Calendar OAuth routes, push notifications, Geo/Maps link resolution (`/api/geo/resolve-maps-link`).

## Request shape (verified example)

Attendance page `dashboard/classes/[slug]/attendance/page.tsx`:
`getSessionUser()` → `getClassBySlug()` → `getClassRole()` → `Promise.all([listClassSubjects, listClassAttendanceMeetings, getClassAttendance])` → renders `ClassAttendanceWorkspace` (client) with sticky sidebar layout; session detail via `AttendanceSessionPanel` (fetches `/api/classes/[slug]/attendance/meetings/[id]`).
Assignment workspace `assignments/page.tsx` patterns similarly fan out per role.

## Related

README.md · REPOSITORY_INVENTORY.md · TECHNICAL_STACK.md · diagrams/01-current-architecture.mmd
