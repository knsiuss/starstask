# Repository Inventory

Purpose: factual inventory of StarsTask at audit time. Verified via directory listing and file reads (this audit session); counts are from the working tree, not from memory.

## Layout (verified)

- Monorepo root `package.json`: `pnpm@11.10.0`, Node >=20.9.0, scripts for dev/build/lint/typecheck/test, `db:push`, `db:types`.
- `apps/web/` — `@starstask/web` (Next.js app, all app code).
- `packages/contracts/` — `@starstask/contracts` (Zod schemas, radius/status enums).
- `packages/shared/` — `@starstask/shared` (formatting, geolocation math).
- `supabase/migrations/` — **78 migration files** (verified count this session).
- `docs/` — prior docs (PROFILE_ONBOARDING, PERFORMANCE-AUDIT, SCHEDULE_PDF_IMPORT, architecture/).

## Counts (verified this session)

- Pages (`page.tsx`): **78**
- API routes (`route.ts`): **113** (plus `apps/web/src/app/auth/callback/route.ts`)
- Migrations (`.sql`): **78**

## Page areas (actual paths)

- `(console)/admin/**` — applications, assignments, classes, feedback, reports, users, verifications
- `(console)/developer/**` — classes, database, incidents, integrations, logs, security, users, overview
- `(home)/` — landing, privacy, terms
- `(onboarding)/onboarding`
- `(site)/` — classes/[slug], discover, invite/[token], login
- `(workspace)/assignments/**`, `attendance/**`, `classes/**` (including `courses/[courseId]/**` with announcements/assignments/attendance/materials/members/schedule/settings), `dashboard/**` (actions, applications, classes/[slug]/{attendance, leave-requests, manage, review, sessions, submissions}, assignments), `leave-requests/**`, `notifications`, `schedule`, `sessions/**`, `settings/**`, `submit`

## API areas (actual paths, abbreviated)

- `/api/admin/**` (5), `/api/assignments/**` + attachments/completion/moderation/reports (7), `/api/attendance/meetings/[id]/checkin`, `/api/auth/signout`, `/api/calendar/personal/**` (3), `/api/classes/**` (invitations, applications, duplicates, join, lookup, [slug] subtrees: admins, attendance/exports (checklist/meeting/recap/report), attendance/meetings (close/corrections/location/open/reopen), calendar-events, leave-requests (export/forward/review), materials, media, members, schedule (batch/import), status, subjects, submissions), `/api/cron/**` (5: attendance-retention, deadline-reminders, notification-events, notification-retention, session-jobs), `/api/developer/**` (incidents, notes, overview, users), `/api/feedback`, `/api/geo/resolve-maps-link`, `/api/integrations/google-calendar/**` (3), `/api/leave-requests/**` (7 incl. evidence, ocr, submit), `/api/my-assignments`, `/api/notifications/read`, `/api/profile/**` (4), `/api/push/**` (3), `/api/saved-assignments/**` (2), `/api/sessions/**` (9), `/api/verification/**` (7)

## Cron (verified `apps/web/vercel.json`)

- `0 3 * * *` → `/api/cron/attendance-retention`
- `0 4 * * *` → `/api/cron/notification-retention`
- Route-level cron files exist without vercel.json entries: `deadline-reminders`, `notification-events`, `session-jobs` — scheduling mechanism for those three is unverified (hypothesis: manual/external scheduler, open question).

## Data layer paths

- `apps/web/src/lib/db/*` per-domain query modules (assignments, attendance, classes, leave, notifications, schedule, etc.)
- `apps/web/src/types/database.ts` hand-written + `database.generated.ts` + `database-contract.ts` drift assertions
- `apps/web/src/features/**` client-side feature modules (e.g., `attendance-meetings`)

## Related

README.md · CURRENT_ARCHITECTURE.md · TECHNICAL_STACK.md
