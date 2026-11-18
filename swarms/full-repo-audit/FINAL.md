# FINAL — StarsTask Full Repository Audit

**Date:** 2026-11-18  
**Verification Status:** All 4 audit tasks (`T1`–`T4`) verified `PASS` by `audit-checker` (read-only audit; zero source files modified).

---

## Baseline Health Summary `[T4]`

| Check | Command | Exit Code | Summary |
| :--- | :--- | :---: | :--- |
| Lint | `pnpm lint` | `0` | `apps/extension` and `apps/web` (`eslint .`) passed with 0 errors. |
| Typecheck | `pnpm typecheck` | `0` | `packages/shared`, `apps/extension`, `packages/contracts`, and `apps/web` (`tsc --noEmit`) all passed. |
| Unit Tests | `pnpm test` | `0` | `apps/extension`: `2/2` files (`11/11` tests). `apps/web`: `119/119` files (`1,247/1,247` tests). |
| Root Format | `pnpm format:check` | `1` | Prettier differences in `4` files in `apps/web/src/`, `9` files in `supabase/migrations/`, and `78` files in `swarms/`. |

---

## HIGH Severity Findings (Fix First)

1. **`[T1]` Self-escalation of course access scope (`selected` → `all`)**
   - `apps/web/src/app/api/classes/[slug]/members/me/courses/route.ts:15-18,58-92` & `apps/web/src/lib/db/course-access.ts:149-243`
   - A member restricted to `course_scope = 'selected'` by a class manager can call `PUT /api/classes/[slug]/members/me/courses` with `{ "scope": "all" }` and bypass the restriction.
   - **Fix:** Block non-managers from changing `course_scope` from `"selected"` back to `"all"` in `PUT /api/classes/[slug]/members/me/courses` (or `setMemberCourseAccess`).

2. **`[T2]` `/developer/observability` placed in `(workspace)` instead of `(console)/developer`**
   - `apps/web/src/app/(workspace)/developer/observability/page.tsx:14-16,38-75` & `apps/web/src/components/developer/developer-nav.tsx:27-37`
   - Bypasses `DeveloperLayout`'s `requireDeveloperPageAccess("/developer")` email allowlist, renders in student workspace shell, contains 7 `any` casts, and has an unused `supabase` variable.
   - **Fix:** Move to `(console)/developer/observability/page.tsx`, enforce `requireDeveloperPageAccess`, add to `DEVELOPER_ITEMS`, and remove `any` casts.

3. **`[T2]` `CallButton` & `StoryRow` unhandled errors, broken video preview, `as any`, and UI emojis**
   - `apps/web/src/components/messages/call-button.tsx:16-66` & `apps/web/src/components/messages/story-row.tsx:25,55,66,104`
   - Missing `try/catch` around `getUserMedia`/`createOffer`/inserts, `<video>` never binds `srcObject`, uses `"dm_calls" as any` / `"dm_stories" as any`, renders raw emojis (`📞`, `📹`, `👤`), and uses `window.location.reload()`.
   - **Fix:** Add `dm_calls`/`dm_stories` to generated DB types, add `try/catch` + error UI, bind `videoRef.current.srcObject`, replace emojis with Lucide icons, and update state instead of reloading.

4. **`[T4]` Mobile Google Integration Disconnect sends `GET` Intent to `POST`-only endpoints**
   - `apps/mobile/android/app/src/main/java/id/starstask/mobile/data/Integrations.kt:20-38` vs `api/integrations/google-calendar/disconnect/route.ts:18` & `google-drive/disconnect/route.ts:12`
   - Browser `ACTION_VIEW` triggers `GET`, resulting in `405 Method Not Allowed`.
   - **Fix:** Send an authenticated `POST` request with `Authorization: Bearer <accessToken>`.

5. **`[T4]` Mobile DM E2EE only implements v1 (`dm_keys`), incompatible with web E2EE v2 (`v2:`/`v2g:`)**
   - `apps/mobile/.../DmKeys.kt:28-41`, `DmChat.kt:112,168,199` vs `apps/web/src/lib/crypto/e2ee-v2.ts:16-45` & `20270126000000_dm_e2ee_v2_devices.sql`
   - Android cannot decrypt `v2:`/`v2g:` envelopes sent from web devices.
   - **Fix:** Implement `/api/dm/devices` and `/api/dm/conversations/[id]/sender-keys` on mobile or negotiate capability before sending v2.

---

## MEDIUM Severity Findings

6. **`[T1]` Unsanitized PostgREST `.or()` filter interpolation in `POST /api/classes/lookup`**
   - `apps/web/src/app/api/classes/lookup/route.ts:16-21,78,100,119`
   - **Fix:** Strip/reject PostgREST filter metacharacters (`,`, `(`, `)`, `*`, `\`) or move lookup into a parameterized RPC.

7. **`[T1]` Fail-open `catch` in `filterRosterByCourseAccess`**
   - `apps/web/src/lib/db/course-access.ts:59-97`
   - **Fix:** Throw `DataAccessError` instead of returning the unfiltered roster.

8. **`[T1]` Missing `enforceRateLimit` on 5 class/course mutation endpoints**
   - `branding/route.ts`, `comments/[commentId]/reactions/route.ts`, `comments/[commentId]/route.ts`, `members/courses/route.ts`, `members/me/courses/route.ts`.

9. **`[T1]` 9 legacy DM routes lack route-level `getSessionUser()`, user-keyed rate limits, and Zod**
   - `api/dm/conversations/**` & `api/dm/keys/me/route.ts`.

10. **`[T2]` `chat-pane.tsx` silently swallows `react`/`togglePin` errors and puts `"Copied to clipboard"` in `error` state**
    - `apps/web/src/components/messages/chat-pane.tsx:756,762,814,821,1190-1211,1263,1270-1283`.

11. **`[T2]` 59 oversized UI/page files (>300 lines) & missing `(workspace)/error.tsx` + async `loading.tsx`**
    - Led by `chat-pane.tsx` (2,092), `actions/page.tsx` (1,299), `leave-form.tsx` (1,210); add `(workspace)/error.tsx` and `loading.tsx` for `/invite/[token]`, `/d/[token]`, `/onboarding`.

12. **`[T3]` `dm_sender_keys_owner_update` RLS `WITH CHECK` omits participant validation**
    - `supabase/migrations/20270126000000_dm_e2ee_v2_devices.sql#L121-L125`.

13. **`[T3]` Unbounded strings & `students` array in `packages/contracts/src/attendance-sync.ts#L14-L34`**

14. **`[T3]` `gradeWeightsSchema` `1e-6` tolerance vs PostgreSQL `numeric(5, 2)` exact `= 100`**
    - `packages/contracts/src/academic.ts#L185-L193` vs `20270125010000_attendance_cutoff_and_grade_validation.sql`.

15. **`[T4]` Mobile parity gaps for new lecturer/course features**
    - Missing BAP fields (`ClassAttendance.kt`), lecturer leave outcomes (`LeaveRequests.kt`), and course-scoped invitations / `class_members.course_scope` (`ClassInvites.kt` — normalized from `CONFLICTS.md`).

---

## LOW Severity Findings

- **`[T1]`** `select("*")` on internal observability views in `lib/db/plugins.ts:170-180`; raw `error.message` forwarded in 3 routes (`claim-lecturer`, `comments`, `materials/upload`).
- **`[T2]`** Dead nav matching in `DeveloperNav`/`AdminNav`; 3 `eslint-disable` comments missing inline `-- reason`; `👍` UI emoji in `course-discussion-thread.tsx:263`.
- **`[T3]`** `class_export_branding` missing DB `CHECK` constraints; `accept_class_invitation`/`accept_pending_invitation` increment `used_count` on `ON CONFLICT DO NOTHING`; `classJoinResultSchema.candidates` lacks `.max(...)`.
- **`[T4]`** `Calendar.kt:504` reads `eventId` at root instead of `data.eventId`; newer web endpoints (`sync-code`, `course_comments`, `import-krs`) not yet on mobile; 4 `apps/web/src/` files & 9 migrations need Prettier formatting.

---

## DONE MEANS Verification

- `[x]` **T1** (`outputs/T1.md` → `checks/T1.md` **PASS**)
- `[x]` **T2** (`outputs/T2.md` → `checks/T2.md` **PASS**)
- `[x]` **T3** (`outputs/T3.md` → `checks/T3.md` **PASS**)
- `[x]` **T4** (`outputs/T4.md` → `checks/T4.md` **PASS**)
- `[x]` **Independent Checker** verified all 4 outputs and recorded `checks/CONFLICTS.md`.
