# Offline Attendance Check-In — Plan

**Date:** 2026-11-18
**Surface:** `apps/web` (Next.js 16) + `apps/web/public/sw.js`
**Status:** Implementation in progress
**Decided on replay semantics:** server time (see locked decision 1). The existing
`sync_offline_attendance_meeting` RPC is explicitly **not** used: it validates against
captured time, which is the native mobile trust model, not the web one. Known consequence:
a capture at 07:00 synced at 09:30 falls outside the window and is rejected as
`checkin_closed` (or recorded as `late`).

## Goal

Let a student press "Check in" while offline and have the check-in recorded on the
server later, without changing the existing server trust model. Scope is the two
student check-in flows only:

- `POST /api/attendance/meetings/[id]/checkin` (meeting check-in)
- `POST /api/sessions/[id]/checkin` (in-person session check-in)

No other endpoints get offline write support in this phase.

## Locked decisions

1. **Server time wins.** Replay uses the server's `now()` for window / late checks.
   RPCs stay untouched. **Web contract consequence:** the current `attendanceMeetingCheckInSchema`
   / session check-in schema reject a `capturedAt` older than 60 seconds, so an offline replay
   that re-sends the original `capturedAt` fails with `validation_error`. Replay must
   therefore **omit `capturedAt` entirely** (it is optional) and keep it client-side as audit
   metadata inside the outbox entry. Server-side `p_captured_at` becomes `null` and `now()`
   decides. This is zero server change and zero contract change.
   Do not use or modify `sync_offline_attendance_meeting` (captured-time trust model, native-only).
2. **No Play Store / Capacitor for now.** The app stays a PWA. `manifest.ts` already
   declares `display: "standalone"`, so installing from the browser home screen is enough.
3. **No caching of authenticated HTML.** `sw.js` currently has no `fetch` handler _by
   design_ (see the header comment). This plan adds a `fetch` handler that caches only
   static assets and an offline app shell, never personalized pages.
4. **Stale queue entries are expected.** Because the window is closed by sync time, entries
   captured but not synced before close become terminal `checkin_closed`/`late` on replay.
   The UI must say this plainly in the pending state.

## What already exists (do not rebuild)

- Push-only service worker `apps/web/public/sw.js` registered via `src/lib/push/service-worker.ts`.
- Installable manifest `src/app/manifest.ts` (route `/manifest.webmanifest`, 192/512/maskable icons).
- Server-side dedupe for the meeting flow: `check_in_attendance_meeting` locks
  `discussion_sessions` `FOR UPDATE` and returns `already_checked_in: true` when a row exists.
  Replaying is therefore safe.
- Idempotency-key convention already used in leave requests
  (`leave_requests.idempotency_key`, Zod `idempotencyKey`).
- Client location capture in `src/lib/geo/position.ts` (already carries `capturedAt`).
- UI call sites: `src/components/attendance/student-meeting-list.tsx` and
  `src/components/attendance/active-attendance-session-card.tsx`.

## Architecture

### 1. Offline read shell (Level A)

- Add a `fetch` handler to `sw.js` with a strict allowlist:
  - Precache: `/offline` (new static route, no personal data), `/icons/*`, `/_next/static/*`.
  - Runtime: `cache-first` for `/_next/static` (immutable), `network-only` for everything else,
    `network-first` with offline fallback only for the two check-in pages:
    `/attendance/checkin/[sessionId]` and `/attendance`.
    These pages must render their personalized parts **client-side** from IndexedDB, otherwise
    the fallback would leak the last visitor's data on a shared device.
- Serve `/offline` (or the shell) when a navigation request fails.
- `message` handler: `CLEAR_OFFLINE_STORAGE` wipes caches + IndexedDB stores on logout.
- Update the header comment in `sw.js`; do not leave the stale "no fetch handler" note.

**Required refactor for the two check-in pages to be safe offline:**
`StudentMeetingList` already receives `meetings` + `identity` from the server. Add a client
module that mirrors the last successful payload (meetings + identity + the user's own check-in
state) into IndexedDB, and a client-side fallback path that renders from it when the network
request fails. No SSR output is ever cached.

### 2. Offline write queue ("outbox")

New client module `src/lib/offline/checkin-outbox.ts` (+ `src/lib/offline/db.ts`):

```
checkin_outbox store (IndexedDB, DB "starstask-offline" v1)
  id: string (uuid, = clientRequestId)
  kind: "attendance-meeting" | "session"
  endpoint: string                 // "/api/...", fixed by kind, never free-form
  sessionId: string
  body: { fullName?, nim?, latitude, longitude, accuracy, clientRequestId }
  capturedAt: number               // Date.now() at capture
  status: "pending_sync" | "syncing" | "sent" | "failed"
  attempts: number
  lastError: string | null
  createdAt: number
```

- `enqueue(kind, sessionId, body)` → writes `pending_sync`, returns the outbox entry.
- `flush()` → replays in FIFO order; marks `syncing`, POSTs, then `sent` (with server status)
  or `failed` (terminal codes) / back to `pending_sync` (transient).
- Terminal codes: `checkin_closed`, `checkin_unavailable`, `checkin_identity_missing`,
  `checkin_name_mismatch`, `checkin_nim_mismatch`, `checkin_too_far`, `checkin_imprecise`,
  `validation_error` → `failed`, surfaced to the user, never auto-retried.
  Anything else (network failure, 5xx, `serviceUnavailable`) stays `pending_sync` with backoff.
- `window.addEventListener("online", flush)` + an interval while the app is open + a
  Background Sync (`registration.sync.register("checkin-outbox")`) as a best-effort bonus.
  Background Sync is Chromium-only; the `online` listener is the guaranteed path.
- Service worker `sync` handler → `clients.matchAll` → postMessage `FLUSH_OUTBOX`; the client
  does the fetch (SW cannot carry the session cookie reliably for `force-dynamic` routes, and
  keeping fetch in the page keeps one code path).
- `clientRequestId` is generated per tap so a double-tap or a replay race produces one entry;
  the server's own upsert already prevents a duplicate row.

### 3. UI changes (additive only)

In `student-meeting-list.tsx` and `active-attendance-session-card.tsx`:

- On `fetch` network failure (TypeError / `navigator.onLine === false`): enqueue, show
  "Tersimpan, akan tersinkron saat online" (EN/ID strings follow existing copy style), set the
  local check-in state to a new `pending_sync` variant.
- On mount + `online`: read outbox, flush, and reconcile each entry against the server response
  (`already_checked_in` or fresh `status` → confirmed; terminal code → error with reason).
- Reuse existing `ResultFailure` / `setCheckIn` states; no new design system pieces.
- Show a small persistent "N absen menunggu sinkron" badge in the attendance area when the
  outbox is non-empty.

### 4. Anti-cheat stance

- Keep server-side radius/accuracy/window enforcement untouched.
- Record `clientRequestId`, `capturedAt`, and `attempts` in the outbox; optionally log them via
  `log_attendance_verification` later. **Do not** add a trust path that bypasses the RPC.
- Do not claim the feature defeats clock or GPS spoofing; document it as "casual tampering only".

### 5. Session expiry while offline

- If the Supabase session expires between capture and replay, the replay gets `401`. Keep the
  entry `pending_sync`, show "Masuk lagi untuk menyinkronkan N absen", flush after re-login.

## Out of scope

- Any write endpoint other than the two check-ins.
- Static export / Capacitor / React Native.
- Changing `check_in_attendance_meeting` or `check_in_session`.
- Caching authenticated HTML or API responses.
- Conflict resolution beyond "server is the truth".
- Lecturer/admin attendance flows.

## File map (expected)

| Path                                                                                              | Action                                                                       |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/web/public/sw.js`                                                                           | add `fetch` (allowlisted), `sync`, `message` handlers; update header comment |
| `apps/web/src/app/offline/page.tsx`                                                               | new static offline fallback                                                  |
| `apps/web/src/lib/offline/db.ts`                                                                  | IndexedDB open/store helpers                                                 |
| `apps/web/src/lib/offline/checkin-outbox.ts`                                                      | enqueue / flush / subscribe                                                  |
| `apps/web/src/lib/offline/checkin-cache.ts`                                                       | persist + read last student view payload                                     |
| `apps/web/src/components/attendance/student-meeting-list.tsx`                                     | offline submit + reconcile                                                   |
| `apps/web/src/components/attendance/active-attendance-session-card.tsx`                           | offline submit + reconcile                                                   |
| `apps/web/src/components/pwa/offline-outbox-provider.tsx` (or extend `ServiceWorkerRegistration`) | wire `online` + `message` → flush                                            |
| `apps/web/src/app/(workspace)/attendance/checkin/[sessionId]/page.tsx` + `attendance/page.tsx`    | render cached view on failure (client component split)                       |
| `apps/web/tests/unit/checkin-outbox.test.ts`, `service-worker.test.ts` additions                  | fake IndexedDB + fake SW                                                     |

## Execution plan (multi-agent)

1. **spec-architect** — turn this doc into `tasks/OFFLINE-ATTENDANCE.md` with atomic tasks + machine-checkable gates (typecheck, unit tests, `pnpm build`).
2. **task-builder** (one per task, sequential where files overlap):
   - T1 `lib/offline/*` + tests (no UI)
   - T2 `sw.js` fetch/sync/message + `/offline` + tests
   - T3 meeting check-in flow wiring
   - T4 session check-in flow wiring
   - T5 pending badge + reconcile UI
3. **adversarial-verifier** — diff review, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` in `apps/web`; hunt for regressions in push behavior and cache leakage.

Parallelism limit: T3/T4 touch different components but share `lib/offline/*`; run T1 first,
then T2/T3/T4 may overlap, T5 last, verifier last. Honest expectation: 4–6 builder passes, not one.

## Risks / open questions

- **Offline accuracy**: indoor GPS often exceeds the 100 m server cap → replayed check-ins will
  be rejected as `checkin_too_far`/`checkin_imprecise`. UI must show that reason plainly.
- **Window closed before sync**: with server time, a capture at 07:00 synced at 09:30 lands as
  `checkin_closed` (or `late`). This is the accepted trade-off of the chosen trust model; it must
  be communicated to students in the pending state copy.
- **Foreground-only flush on iOS/Safari**: no Background Sync; syncing happens when the app is open.
  Consider making the meeting page poll `flush()` on an interval while visible.
- **Shared device**: the cached student view must be wiped on logout; verify this in the verifier pass.
- Parallel agents are editing the repo (`git status` shows unrelated modifications in
  `(home)/privacy`, lecturer surfaces, profile surfaces). Do not touch those; re-check
  `git status --porcelain` before every edit.

## Gates

```
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

No task is done until all four are green or a failure is explicitly attributed to a pre-existing,
unrelated file with evidence.
