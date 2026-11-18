# FINAL — StarsTask Audit Fixes (`P1`–`P4`)

**Date:** 2026-11-18  
**Verification Status:** All 4 patch tasks (`P1`–`P4`) verified `PASS` by independent `fix-checker` with zero cross-task conflicts (`checks/CONFLICTS.md`).

---

## Summary of Implemented Fixes

### P1 — Web API, Auth, Rate Limit & Data Hygiene
- **Self-escalation guard** (`apps/web/src/app/api/classes/[slug]/members/me/courses/route.ts`): Non-managers with `course_scope = 'selected'` are blocked (`403`) from escalating back to `scope: "all"`.
- **PostgREST `.or()` sanitization** (`apps/web/src/app/api/classes/lookup/route.ts`): Strips `,`, `(`, `)`, `*`, and `\` before building `.or()` filters.
- **Fail-closed roster filter** (`apps/web/src/lib/db/course-access.ts`): `filterRosterByCourseAccess` throws `DataAccessError` on query failure instead of returning an unfiltered roster.
- **Rate limiting added** to 5 mutation endpoints: `branding/route.ts`, `comments/[commentId]/reactions/route.ts`, `comments/[commentId]/route.ts`, `members/courses/route.ts`, `members/me/courses/route.ts`.
- **View column allowlists & safe errors**: Replaced `.select("*")` in `apps/web/src/lib/db/plugins.ts` with explicit columns and replaced raw `error.message` forwarding in `claim-lecturer`, `comments`, and `materials/upload`.

### P2 — Web UI, Developer Route, Error Boundary & Quality
- **Moved `/developer/observability`** from `(workspace)/` to `(console)/developer/observability/page.tsx` with `requireDeveloperPageAccess`, typed view rows (0 `any`), and added it to `DEVELOPER_ITEMS` in `developer-nav.tsx`.
- **Hardened `CallButton` & `StoryRow`** (`apps/web/src/components/messages/`): Added `try/catch` + error UI, bound `localStream` to `videoRef.current.srcObject`, removed `as any`, replaced emojis with Lucide icons, and replaced `window.location.reload()` with state update + `router.refresh()`.
- **Fixed `ChatPane`** (`chat-pane.tsx`): Added `response.ok` checks + rollback/error state for `react`/`togglePin`, and separated `notice` state for `copyMessage`.
- **UI polish & error boundary**: Replaced `👍` in `course-discussion-thread.tsx` with Lucide `ThumbsUp` and added `apps/web/src/app/(workspace)/error.tsx`.

### P3 — SQL Migration Hardening & Contracts Bounds/Precision
- **Migration `supabase/migrations/20270131000000_audit_security_and_constraints_fixes.sql`**:
  - Hardened `dm_sender_keys_owner_update` `WITH CHECK` to validate active `dm_participants` for both `owner_user_id` and `recipient_user_id`.
  - Fixed `accept_class_invitation` & `accept_pending_invitation` so `used_count` increments only when a new row is inserted (`IF FOUND`).
  - Added `NOT VALID` `CHECK` constraints on `class_export_branding` (`passing_threshold` `0..100` and text lengths).
- **Contracts**: Added `.max(...)` bounds in `attendance-sync.ts`, 2-decimal precision enforcement in `academic.ts` (`gradeWeightsSchema`), and `.max(50)` on `candidates` in `profile.ts`.

### P4 — Mobile Integrations/Calendar & Prettier Cleanup
- **`Integrations.kt` & `SettingsScreens.kt`**: Replaced `GET` browser `Intent` disconnect with authenticated `POST` (`Authorization: Bearer <token>`).
- **`Calendar.kt`**: Parsed `data.eventId` with root fallback.
- **Prettier**: Formatted the 13 targeted `apps/web/src/` and `supabase/migrations/` files.

---

## Verification Results (`fix-checker`)
- `pnpm lint`: **PASS** (`exit code 0`)
- `pnpm typecheck`: **PASS** (`exit code 0`)
- `pnpm test`: **PASS** (`apps/extension`: 2 files / 11 tests; `apps/web`: 119 files / 1,247 tests)
- Prettier check across all 35 touched/target files: **PASS** (`exit code 0`)
- Local migration `20270131000000_audit_security_and_constraints_fixes.sql`: **PASS** (applied to `127.0.0.1:54322`)
