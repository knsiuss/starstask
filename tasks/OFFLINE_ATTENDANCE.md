# OFFLINE_ATTENDANCE — Web Offline Check-In Execution Plan

**Date:** 2026-11-18
**Design source:** `docs/OFFLINE_ATTENDANCE.md` (status: Implementation in progress)
**Task file:** `tasks/OFFLINE_ATTENDANCE.md`
**Scope surface:** `apps/web` only (Next.js 16 PWA + `public/sw.js`). No `apps/mobile`, no `supabase/`.

This file is the execution contract. A builder may not merge a task whose verification command fails, and may not touch files outside the task's **Allowed files** list without amending this spec first.

---

## 1. Overview

Let a student press "Check In" while offline. The reading is stored on-device in an IndexedDB outbox, and when the device is back online the outbox is replayed against the **existing, unmodified** check-in endpoints:

- `POST /api/attendance/meetings/[id]/checkin` (meeting check-in)
- `POST /api/sessions/[id]/checkin` (in-person session check-in)

No other endpoint gets offline write support. Offline banners, pending-sync UI, and a static `/offline` fallback page are all new. All server-side trust — Supabase session, window, radius, accuracy, membership, identity — is unchanged.

### Locked decisions (do not revisit, do not re-litigate)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **Server time wins on replay.** Replay re-POSTs the two endpoints with **no `capturedAt`**. `attendanceMeetingCheckInSchema` and `sessionCheckInSchema` require `capturedAt` to be within 60 s of `Date.now()`; it is optional, so omitting it is valid and yields server `now()` as the window/late authority. `p_captured_at` is `null`. **Zero RPC change, zero contract change.** `capturedAt` is kept client-side only, inside the outbox entry as audit metadata, and never sent on replay. |
| L2  | `sync_offline_attendance_meeting` (migration `20270113000000_offline_checkin_sync.sql`, captured-time bounds, `method = 'offline_sync'`) is the **native** offline trust model and is explicitly **out of scope**. Do not call it, do not reuse it, do not modify it. Replay goes through the two web endpoints only.                                                                                                                                                                             |
| L3  | No Play Store / Capacitor / static export. The app stays a PWA. `src/app/manifest.ts` already declares `display: "standalone"` — do not change it, do not add Capacitor.                                                                                                                                                                                                                                                                                                                          |
| L4  | No caching of authenticated HTML or API responses. `sw.js` gains a `fetch` handler with a strict allowlist only; SSR output is **never** cached and never readable by the shell.                                                                                                                                                                                                                                                                                                                  |
| L5  | Stale queue entries are expected. Replay whose capture fell outside the attendance window is rejected server-side and recorded as terminal `checkin_closed` / `late` (per the design doc's locked decision 4 and risk list). The UI must say this in plain language in the pending state.                                                                                                                                                                                                         |
| L6  | Scope is **only** the two check-in endpoints above. No other write, no lecturer/admin flows, no conflict resolution beyond "server is the truth".                                                                                                                                                                                                                                                                                                                                                 |
| L7  | Gates per task and for the whole milestone: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — all run **inside `apps/web`**.                                                                                                                                                                                                                                                                                                                                                             |

---

## 2. Scope and non-goals

### In scope

- `public/sw.js`: allowlisted `fetch` handler, `sync` handler, `message` (`CLEAR_OFFLINE_STORAGE`, `FLUSH_OUTBOX`) handlers, header comment updated.
- Static `/offline` route with no personalized or dynamic data.
- New client library `src/lib/offline/*`: IndexedDB helper, outbox (enqueue / flush / subscribe), check-in view cache.
- Client-side pending-sync and reconcile UI in the two existing check-in components; a pending badge in the attendance area.
- Offline read fallback for exactly these two pages, rendered from IndexedDB, never from cached SSR:
  - `/(workspace)/attendance` (`src/app/(workspace)/attendance/page.tsx`)
  - `/(workspace)/attendance/checkin/[sessionId]` (`src/app/(workspace)/attendance/checkin/[sessionId]/page.tsx`)
- Logout wipe (`CLEAR_OFFLINE_STORAGE`) wired into both sign-out call sites present today:
  1. `src/components/layout/user-menu.tsx` — line 46, `void fetch("/api/auth/signout", { method: "POST" })`
  2. `src/components/profile/account-danger-zone.tsx` — line 150, `void fetch("/api/auth/signout", { method: "POST" }).catch(() => null)`
- Background Sync as an **optional sub-task** owned by T2, with iOS/Safari notes (see T2).

### Out of scope (do not implement, do not plan)

- Any write endpoint other than the two check-ins; leave requests, corrections, organiser/admin flows.
- Any change to `check_in_attendance_meeting`, `check_in_session`, `check_in_discussion_session`, or their freshness wrappers (`20261106000000_geofencing_freshness.sql`), or to any file in `supabase/`.
- Any change to `packages/contracts` schemas or constants (`ATTENDANCE_*`, `SESSION_CHECKIN_ACCURACY_MAX_M`, `CHECKIN_POSITION_MAX_AGE_MS`, `getSessionCheckInWindow*`).
- Any use or modification of `sync_offline_attendance_meeting` and `method = 'offline_sync'`.
- Auth model changes, `requireSession()` / `getSessionUser()` changes, RLS, `log_attendance_verification` changes (logging clientRequestId is optional future work, listed in risks but not a task).
- Background Sync as a required path (Chromium-only; the guaranteed path is the `online` listener + foreground interval).
- Push-notification behavior changes, `service-worker.ts` registration semantics, `manifest.ts`, icons, theming.
- The native app (`apps/mobile`), Capacitor, Play Store, static export, service worker generated by a library (Workbox, `next-pwa`).
- Caching authenticated HTML, RSC payloads, API JSON, Supabase responses — **never**. The allowlist below must not silently widen.

---

## 3. Machine-checkable verification gates

Every task must satisfy the four gates from `apps/web`:

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Interpretation:

- `pnpm test` runs `vitest run` (config `vitest.config.ts`, environment `node`, include `tests/unit/**/*.test.ts`). Tests that need DOM/IndexedDB **must** either stub `globalThis.indexedDB` themselves (preferred — no new dependency) or use an in-test fake; this repo has **no** `fake-indexeddb` / `fake-idb` / jsdom / happy-dom as a direct dependency (lockfile shows jsdom 26 only via vitest for `environment: "node"`). Do not add an IndexedDB library in this milestone — write a small in-test stub. If a builder believes this is impossible, stop and report; do not add the dependency silently.
- `pnpm lint` is `eslint .` — zero errors, zero warnings, no new `eslint-disable`.
- `pnpm typecheck` is `tsc --noEmit` in strict project config. **No `any`.** Use `unknown` + narrowing.
- Every task additionally lists a file-scoped vitest command, e.g. `pnpm vitest run tests/unit/checkin-outbox.test.ts`, for fast iteration.

Baseline note: `git status --porcelain` today shows pre-existing parallel-agent modifications (see §9). A red gate is only attributable to this milestone if the failing command is green for the files this milestone owns; record the pre-existing state (errors, files) before starting any task, exactly as `AGENTS.md` §2 requires. If any full gate fails for an unrelated parallel-agent file, attribute it explicitly in the task report with evidence; do not fix that file.

Gates are **per task** and **for the final milestone verifier pass**. Do not mark T5 or the verifier done while any gate is red.

---

## 4. File ownership map (who may touch what)

| Path                                                                                                                   | Task(s)                                               | Forbidden for       |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------- |
| `apps/web/src/lib/offline/db.ts` (new)                                                                                 | T1                                                    | all after T1 merges |
| `apps/web/src/lib/offline/checkin-outbox.ts` (new)                                                                     | T1                                                    | all after T1 merges |
| `apps/web/src/lib/offline/checkin-cache.ts` (new)                                                                      | T1                                                    | all after T1 merges |
| `apps/web/src/lib/offline/types.ts` (new)                                                                              | T1                                                    | all after T1 merges |
| `apps/web/tests/unit/checkin-outbox.test.ts` (new)                                                                     | T1                                                    | all after T1 merges |
| `apps/web/tests/unit/checkin-cache.test.ts` (new)                                                                      | T1                                                    | all after T1 merges |
| `apps/web/tests/unit/offline-db.test.ts` (new)                                                                         | T1                                                    | all after T1 merges |
| `apps/web/public/sw.js`                                                                                                | T2                                                    | any other task      |
| `apps/web/tests/unit/service-worker.test.ts`                                                                           | T2                                                    | any other task      |
| `apps/web/src/app/offline/page.tsx` (new)                                                                              | T2                                                    | any other task      |
| `apps/web/src/app/offline/layout.tsx` (new, only if needed — see T2)                                                   | T2                                                    | any other task      |
| `apps/web/src/components/pwa/offline-outbox-provider.tsx` (new) — OR extend `service-worker-registration.tsx` (see T5) | T5                                                    | any other task      |
| `apps/web/src/components/pwa/service-worker-registration.tsx`                                                          | T5 (only if provider extends it; otherwise untouched) | —                   |
| `apps/web/src/components/layout/user-menu.tsx`                                                                         | T6                                                    | —                   |
| `apps/web/src/components/profile/account-danger-zone.tsx`                                                              | T6                                                    | —                   |
| `apps/web/src/components/attendance/student-meeting-list.tsx`                                                          | T3                                                    | —                   |
| `apps/web/src/components/attendance/active-attendance-session-card.tsx`                                                | T4                                                    | —                   |
| `apps/web/src/app/(workspace)/attendance/checkin/[sessionId]/page.tsx`                                                 | T3                                                    | —                   |
| `apps/web/src/app/(workspace)/attendance/page.tsx`                                                                     | T7 (split for cached read fallback)                   | —                   |
| `apps/web/src/components/attendance/offline-*` (new small client components)                                           | T3/T7 as specified in the task                        | —                   |
| `tasks/OFFLINE_ATTENDANCE.md`                                                                                          | coordinator only                                      | all builders        |

Ownership rules:

- One task owns one file at a time. If a task discovers it needs a file owned by an unfinished parallel task, stop and report.
- `student-meeting-list.tsx` and `active-attendance-session-card.tsx` share **types** from `@/lib/offline/*` and copy style/behaviour patterns, but are edited only in their own tasks (T3 / T4).
- `public/sw.js` has exactly one editor: the T2 builder. No other task edits it, including to "fix" something.
- Anything not listed: do not edit. Pre-existing parallel-agent files are listed in §9 and are explicitly forbidden.

---

## 5. Anti-dempet standards (binding)

All new and modified code in this milestone must satisfy:

- **No useless comments**: comments explain WHY or non-obvious constraints only; never restate the line; no commented-out code; no stale headers. When T2 adds the `fetch` handler it must **update** the stale "no `fetch` handler by design" header comment in `sw.js`, not leave it contradicted.
- **No `any`**: explicit types, `unknown` + narrowing, no implicit `any`, no unchecked `as` except with a short reason comment.
- **No dead code**: every export used; no unused parameters; no placeholder branches that are never taken; no "just in case" helpers. If it exists, it is wired or it is deleted.
- **No unnecessary abstractions**: three stores/three functions before a shared abstraction; no generic "OfflineStore<T>"; no event bus; no state manager added. IndexedDB access stays behind one thin module (`lib/offline/db.ts`).
- **No duplicated logic**: outbox replay share one code path between T3/T4 (both call `lib/offline/checkin-outbox.ts`); no per-component reimplementation of fetch/reconcile.
- **300-line soft limit** per new file (AGENTS.md §5.6); split by responsibility, not by layer padding.
- **Zero ESLint errors and warnings** on changed files (`eslint .` clean).
- **Type-only imports** use `import type`.
- **No `console.log`**; use existing patterns (silent swallows where already the app's style, e.g. `registerServiceWorker`, or `console.error` for genuine failures).
- **No secrets, no personal data** in the outbox beyond what the user already confirmed for the server call (full name, NIM, coordinates, `capturedAt`) and never in logs. The cached view stores the same payload the server already renders for this user — nothing more.

---

## 6. Architecture shared by the tasks

### Outbox entry shape (T1 owns the type)

IndexedDB database `starstask-offline`, version `1`, object store `checkin_outbox` (keyPath `id`). One record per offline tap:

```ts
type CheckinOutboxEntry = {
  /** uuid, generated per tap = clientRequestId; id === clientRequestId */
  id: string;
  kind: "attendance-meeting" | "session";
  /** Fixed by kind: "/api/attendance/meetings/[id]/checkin" | "/api/sessions/[id]/checkin" — never free-form, never interpolable from user input. */
  endpoint: string;
  sessionId: string;
  /** What the user confirmed. `capturedAt` stays here as audit metadata only and is NEVER sent on replay (L1). */
  body: {
    fullName?: string;
    nim?: string;
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  /** Date.now() at capture — audit metadata only, never transmitted. */
  capturedAt: number;
  status: "pending_sync" | "syncing" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  /** Date.now() at enqueue. FIFO is by createdAt. */
  createdAt: number;
};
```

Replay POST body is derived from `body` + `sessionId` and **omits `capturedAt`** entirely:

- `attendance-meeting`: `{ fullName, nim, latitude, longitude, accuracy }`
- `session`: `{ latitude, longitude, accuracy }`

### Outbox terminal codes (mapped to `status: "failed"`, surfaced to the user, never auto-retried)

`checkin_closed`, `checkin_unavailable`, `checkin_identity_missing`, `checkin_name_mismatch`, `checkin_nim_mismatch`, `checkin_too_far`, `checkin_imprecise`, `checkin_not_open`, `checkin_not_scheduled`, `checkin_stale_position`, `validation_error`.

Everything else (network TypeError, `navigator.onLine === false`, HTTP 5xx, `serviceUnavailable`, 401) keeps the entry `pending_sync` (401 additionally surfaces "Masuk lagi untuk menyinkronkan N absen" — T5). Transient entries get simple backoff before the next foreground flush (recommend: `attempts`-based delay, e.g. skip entries with `createdAt + attempts * 30_000 > now`, capped; document the choice in code comment).

### Shell caching allowlist (T2 owns these literals)

- **Precached at `install`**: `/offline`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/icons/badge-96.png`.
- **`/_next/static/*`**: `cache-first` (immutable, filename-hashed by Next).
- **`/icons/*`**: `cache-first`.
- **`/offline`**: `network-first` is unnecessary — plain `cache-first` from precache is fine; it is static and non-personalized.
- **`/attendance` and `/attendance/checkin/*` navigation requests**: `network-first`, fall back to the cached shell **only the empty static shell** is never possible here (these are dynamic routes); the offline path is handled client-side by T3/T7 code reading IndexedDB. The SW `fetch` handler may serve a `caches.match("/offline")` for any **failed navigation whose URL is allowlisted**, but never serves cached personalized HTML — there is none.
- **Everything else**: `network-only` (no cache lookup at all).
- `fetch` handler must not intercept non-GET, `/api/*`, `_next/data`, RSC payloads (`?_rsc=`), or Supabase requests. Simplest correct shape: GET only, same-origin only, then the allowlist.
- Caches are namespaced (`starstask-offline-static-v1`) and old caches deleted in `activate`.
- `message` handler: on `CLEAR_OFFLINE_STORAGE`, delete all caches under the namespace and (via `clients.matchAll` or a broadcast) instruct open clients to clear IndexedDB; the actual IndexedDB wipe must happen in the page (the SW cannot reliably touch IndexedDB with the user in mind) — T6 wires the page side.
- `message` handler: on `FLUSH_OUTBOX` (sent by the SW itself from `sync`), notify all clients so the page runs `flush()`. The SW must not perform the check-in fetch itself (session cookie reliability + one code path).
- `sync` handler: `registration.sync.register("checkin-outbox")` is requested best-effort; on `sync` event with tag `checkin-outbox`, `clients.matchAll({ type: "window" })` → `postMessage({ type: "FLUSH_OUTBOX" })` → `event.waitUntil`.
- Header comment rewritten: states what the SW caches, what it never caches, and why.

### iOS/Safari reality (documented in T2 and T5)

Background Sync (`registration.sync`) is not available in Safari/iOS. The guaranteed flush paths are: (a) the `online` window event while the app is open, (b) a foreground `setInterval` in the provider while the page is visible, (c) reconcile-on-mount. The pending-state copy must not promise delivery — only attempt it.

---

## 7. Atomic tasks

Ordering legend: `dependsOn` lists task IDs that must be green before the task starts. `canParallelWith` lists tasks that may run simultaneously. Every task runs the four gates in `apps/web` unless the task itself says otherwise (they all do).

### T1 — Offline library: IndexedDB helper, outbox, check-in view cache (+ tests)

**Goal.** Student check-in taps can be persisted, replayed, and reconciled entirely client-side; no UI yet.

**Allowed files.**

- `apps/web/src/lib/offline/db.ts` (new)
- `apps/web/src/lib/offline/types.ts` (new)
- `apps/web/src/lib/offline/checkin-outbox.ts` (new)
- `apps/web/src/lib/offline/checkin-cache.ts` (new)
- `apps/web/tests/unit/offline-db.test.ts` (new)
- `apps/web/tests/unit/checkin-outbox.test.ts` (new)
- `apps/web/tests/unit/checkin-cache.test.ts` (new)

No other file may be created or modified in this task.

**Deliverables / behavior.**

- `db.ts`: open/close the `starstask-offline` v1 database, create/upgrade stores `checkin_outbox` and `checkin_cache`. Export typed helpers only (`getOutboxStore`, `getCacheStore` or equivalent), no promise library. Handle `onupgradeneeded`. No `any`; typed `IDBRequest` wrappers with a shared `requestToPromise<T>` helper.
- `types.ts`: `CheckinOutboxEntry`, `CheckinOutboxKind`, `OfflineCheckInView` (the last-successful server payload shape: `{ meetings, identity, activeSessions, checkInState }` — mirror exactly what the two pages pass into `StudentMeetingList` / `ActiveAttendanceSessionCard`; import `StudentAttendanceMeeting` from `@/lib/attendance/meeting-types` and `ActiveAttendanceSession` from `@/lib/attendance/types` rather than redefining fields).
- `checkin-outbox.ts`:
  - `enqueue(kind, sessionId, body): Promise<CheckinOutboxEntry>` — validates `kind`, derives `endpoint` from kind (hard-code the two literals; reject anything else), generates `clientRequestId` via `crypto.randomUUID()`, writes `pending_sync` FIFO entry.
  - `flush(fetchImpl = fetch): Promise<FlushResult>` — claims `pending_sync` entries in FIFO order, marks `syncing`, POSTs the derived body **without `capturedAt` (L1)**, then:
    - HTTP 200 + `data.status` → entry `sent` with server status + `alreadyCheckedIn` recorded;
    - HTTP 401 → entry stays `pending_sync`, result flagged `sessionExpired: true`;
    - terminal code in body.error.code (list in §6) → entry `failed` with `lastError` = code;
    - network TypeError / 5xx / `serviceUnavailable` → entry back to `pending_sync`, `attempts + 1`, `lastError` set.
    - Backoff: skip entries whose `attempts > 0` until `createdAt + attempts * 30_000 <= Date.now()` (document why).
  - `list(): Promise<CheckinOutboxEntry[]>`, `count(): Promise<number>`, `remove(id)`, `subscribe(listener): () => void` (simple in-memory pub/sub for badge count; no external state lib).
  - `clearAll(): Promise<void>` — wipes `checkin_outbox` and `checkin_cache` (used by the logout wipe in T6).
- `checkin-cache.ts`: `saveLastView(view: OfflineCheckInView): Promise<void>` and `readLastView(): Promise<OfflineCheckInView | null>` — encrypt or otherwise gate nothing extra; same trust level as the page that produced it. Provide `clearLastView()`.
- Tests use a hand-written in-test IndexedDB stub (object-store fake keyed by keyPath); no new dependencies. Cover: enqueue derives endpoint by kind; replay body omits `capturedAt`; FIFO order; terminal codes → `failed`; 401 → `pending_sync` + `sessionExpired`; transient network error → `pending_sync` + attempts incremented; subscribe/unsubscribe; `clearAll` empties both stores; `save/read/clear` roundtrip respecting storage failures (quota) — must fail silently into a no-op cache, never throw into the UI path.

**Depends on:** nothing. **Can run in parallel with:** T2.
**Verification.**

```bash
cd apps/web
pnpm vitest run tests/unit/offline-db.test.ts tests/unit/checkin-outbox.test.ts tests/unit/checkin-cache.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

**Done when** all five pass in `apps/web`, the replay body is observably free of `capturedAt` in a test assertion, and no file outside the allowed list is modified.

---

### T2 — Service worker: allowlisted `fetch`, `sync`, `message` + static `/offline` page (+ tests)

**Goal.** The installed PWA survives a lost network for static assets and shows a non-personalized offline screen; push behavior and authenticated HTML remain untouched.

**Allowed files.**

- `apps/web/public/sw.js`
- `apps/web/tests/unit/service-worker.test.ts` (extend; keep the existing push-path tests passing)
- `apps/web/src/app/offline/page.tsx` (new)
- `apps/web/src/app/offline/layout.tsx` (new, **only if** the default layout forces client providers/auth; otherwise omit — record the decision)

**Deliverables / behavior.**

- `sw.js` header comment rewritten; no stale "no fetch handler" text.
- `install`: precache the exact literals in §6 (`/offline`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/icons/badge-96.png`). `self.skipWaiting()` retained. `activate`: `clients.claim()`, delete caches not in the current namespace (`starstask-offline-static-v1`).
- `fetch` handler with the §6 allowlist verbatim. GET + same-origin only. `/_next/static/*` and `/icons/*` → `cache-first` with network fallback populating the cache. `/offline` → precached. `/attendance` and `/attendance/checkin/*` navigation requests → `network-first`, on failure `caches.match("/offline")` as the last resort for the **static** fallback only; **no personalized or cached authenticated content is ever served from cache** (there is no such cache). Everything else → `fetch` pass-through with no cache write, including all `/api/*` and RSC payloads.
- `sync` handler for tag `checkin-outbox` (optional Background Sync; see sub-task).
- `message` handler: `CLEAR_OFFLINE_STORAGE` → delete all `starstask-offline-*` caches; then `clients.matchAll({ type: "window", includeUncontrolled: true })` → `postMessage({ type: "CLEAR_OFFLINE_STORAGE" })` so open pages can wipe IndexedDB (T6 owns the page listener).
- `message` handler: `FLUSH_OUTBOX` inbound is **also** accepted from the SW to clients; the handler on the client side is T5's provider. (`sync` → postMessage to clients; clients run `flush()`; SW carries no fetch.)
- Background Sync (optional sub-task, owned here): when handling `sync` tag `checkin-outbox`, `event.waitUntil(notify clients)`. The `register("checkin-outbox")` call is issued from the client provider in T5 **only if** `"sync" in registration`, guarded for Chromium-only availability; Safari/iOS silently skip it — the spec must not claim delivery. In this task, only the SW side is implemented and unit-tested with a fake event.
- `/offline` page: static, no session, no Supabase, no dynamic imports of user data. Bilingual-lite copy following repo style (short ID line + short EN line) with a plain explanation ("You're offline — check-in attempts made here are saved and will be sent when you're online") and a link back to `/`. No personalization, no `noindex` omission (`robots: { index: false }` is appropriate).
- Tests: extend `tests/unit/service-worker.test.ts`-style coverage for the pure helpers extracted to module scope of `sw.js` where feasible, or test the allowlist logic via a small exported helper file only if one is created; the existing registration tests must keep passing unchanged. Do not import `sw.js` wholesale if it side-effects at import time — instead extract pure predicates (`shouldCache(pathname)`, `isStaticAsset`, `isNavigationRequest`) into `src/lib/push/sw-routes.ts` **if and only if** that keeps `sw.js` small; otherwise test via source assertions on the file text. Prefer: extract `sw-routes.ts` (new allowed file — add it above if chosen) with the allowlist predicates, `sw.js` imports them, unit tests cover the predicates exhaustively (GET-only, `/api/*` rejected, `/_next/static` cached, `/offline` cached, `/attendance` navigation network-first, RSC query rejected, cross-origin rejected).

**Depends on:** nothing. **Can run in parallel with:** T1.
**Verification.**

```bash
cd apps/web
pnpm vitest run tests/unit/service-worker.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

**Done when** all five pass, push-path tests remain green unchanged, the header comment is accurate, and the cache allowlist is provably closed (a test asserts an unlisted path is not cached).

---

### T3 — Meeting check-in: offline enqueue + reconcile + cached offline view

**Goal.** `StudentMeetingList` degrades to an on-device "pending sync" state when the network is down and reconciles automatically on reconnect, and the meeting check-in page can render the student's cached view without network.

**Allowed files.**

- `apps/web/src/components/attendance/student-meeting-list.tsx`
- `apps/web/src/app/(workspace)/attendance/checkin/[sessionId]/page.tsx`
- `apps/web/src/components/attendance/meeting-cached-view.tsx` (new, small client component for the offline fallback of the deep-link page; max ~120 lines)
- `apps/web/src/components/attendance/meeting-cache-mirror.tsx` (new, small client component that writes the server payload into IndexedDB on mount; max ~60 lines)
- `apps/web/src/components/attendance/pending-sync-note.tsx` (new, shared pending copy used by T3/T4; coordinate text so both flows render identically — see T4)

**Deliverables / behavior.**

- Split the page minimally: the `force-dynamic` server page keeps its server data fetch and renders the existing server tree, but passes `meetings` + `identity` into a new client wrapper (`MeetingCacheMirror`) that (a) renders its children unchanged and (b) on mount calls `saveLastView`. The SSR output itself is never cached (L4). On network-failure render paths, the **personalized part** (`StudentMeetingList`) must be able to render from IndexedDB: the server page renders `<MeetingCachedView />` (a client component) inside a `<Suspense>`/boundary **only when its own fetch fails**? No — pages cannot detect client network failure. Correct shape: keep the server page unchanged for online; add a **separate** client-only route segment or conditional: when `getStudentAttendanceMeetingView` returns no data because the fetch threw, render `<MeetingCachedView />` which reads `readLastView()` and renders `StudentMeetingList` with cached meetings/identity. If nothing is cached, render a static "you're offline and have no saved view" panel with a link to `/offline`. This is the "client-side render from IndexedDB, never SSR" requirement (L4). Keep the server page a server component; all IndexedDB access lives in the new client components.
- In `StudentMeetingList` (`StudentMeetingCard`):
  - Wrap the `fetch` call: `TypeError` from fetch, or `navigator.onLine === false` before calling it → instead of `setResultFailure`, enqueue via `enqueue("attendance-meeting", sessionId, { fullName, nim, latitude, longitude, accuracy })` (note: `capturedAt` passed as outbox audit metadata, not into the POST body), set `checkIn` to a synthetic `{ status: "pending_sync" }`-like local variant, and render the pending state: badge/copy ("Tersimpan, akan tersinkron saat online. Check-in mengikuti waktu server; jika window sudah tutup saat sinkron, absen akan ditolak.") — exact copy decided with the T4 builder for consistency, no design-system additions, reuse `Alert`/existing badge styles.
  - Location/accuracy/freshness client checks stay as-is and still run **before** enqueue (do not enqueue an unusable reading).
  - HTTP error responses (`!response.ok`) keep the current behavior unchanged; only network-layer failure goes to the outbox.
  - On mount and on `online` events, read the outbox slice for this `sessionId` (and kind), and reconcile: entries `sent` with server status → replace synthetic pending state with the real server-confirmed status; entries `failed` → render `ResultFailure`-style message with the terminal reason; duplicates (already `sent` for this sessionId before mount) → treat as confirmed. Reuse `setCheckIn` / `setResultFailure` machinery; no new dialog.
- The page's own fetch path is not converted to client fetching; only the offline branch is added.

**Depends on:** T1. **Can run in parallel with:** T4, T2.
**Verification.**

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Plus a focused assertion in the task report: a grep that the replay POST body construction in the component does not include `capturedAt` (e.g. `pnpm test` + `git grep -n "capturedAt" apps/web/src/components/attendance/student-meeting-list.tsx` shows it only as prop/audit, not in the enqueue body).

**Done when** gates green; manual dev-server check recorded (list the URL and the steps: kill network → tap Check In → see pending state → restore network → pending resolves to confirmed/rejected). No invented screenshots.

---

### T4 — Session (in-person) check-in: offline enqueue + reconcile + cached offline view

**Goal.** `ActiveAttendanceSessionCard` (student mode) degrades identically to T3 for the `POST /api/sessions/[id]/checkin` flow.

**Allowed files.**

- `apps/web/src/components/attendance/active-attendance-session-card.tsx`
- `apps/web/src/components/attendance/session-cache-mirror.tsx` (new, same shape as `MeetingCacheMirror`; may instead be one shared `CacheMirror` if T3 already shipped it — coordinate via the shared file, do not duplicate)
- `apps/web/src/components/pwa/offline-session-view.tsx` (new only if the `/attendance` page split in T7 needs it; otherwise omit)
- `apps/web/src/components/attendance/pending-sync-note.tsx` (shared with T3; if T3 hasn't merged yet, create it here with identical copy and T3 consumes it — exactly one owner creates the file)

**Deliverables / behavior.** Mirror T3 for the session flow:

- Pre-flight `getSessionCheckInWindowState` unchanged; location/accuracy client checks unchanged and run before enqueue.
- Network-layer fetch failure → `enqueue("session", sessionId, { latitude, longitude, accuracy })`, pending-sync state with the shared pending copy, reuse `SavedCheckIn`-compatible local state plus a `pending_sync` variant. Manager mode (`mode === "manager"`) is untouched: offline applies to the student path only (L6).
- Reconcile on mount + `online`: `sent` → confirmed status; `failed` → `setResultFailure` with `describeCheckInFailure(code)`; `sessionExpired` → "Masuk lagi untuk menyinkronkan N absen" is owned by T5's badge; the card itself shows a plain reconnect hint.
- If T7 (cached page view) is already merged, the session card renders inside the cached view with the same component; otherwise the offline cached-view work for `/attendance` is owned by T7 (do not do it here).

**Depends on:** T1. **Can run in parallel with:** T2, T3.
**Verification.**

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Plus the same `capturedAt` audit grep for `active-attendance-session-card.tsx`.

**Done when** gates green; manager mode diff is empty; student flow mirrors T3 behaviour; pending copy matches T3 exactly.

---

### T5 — Offline outbox provider: `online` / `FLUSH_OUTBOX` / interval wiring + pending badge

**Goal.** One app-level provider flushes the outbox and renders a persistent "N absen menunggu sinkron" badge while the outbox is non-empty; Background Sync registration is best-effort.

**Allowed files.**

- `apps/web/src/components/pwa/offline-outbox-provider.tsx` (new)
- `apps/web/src/components/pwa/service-worker-registration.tsx` (extend **only** to mount the provider, or to register the sync tag — keep diff minimal)
- `apps/web/src/app/layout.tsx` (one-line import/mount if the provider is a sibling of `ServiceWorkerRegistration`; otherwise mount inside it)
- `apps/web/src/components/attendance/outbox-pending-badge.tsx` (new, ~40 lines; used by the attendance page header area — file owned here, consumed by T7's page)

**Deliverables / behavior.**

- Provider (client component):
  - On mount: `flush()` once.
  - `window.addEventListener("online", flush)`; `visibilitychange` → flush when becoming visible; `setInterval(flush, 30_000)` while mounted (foreground only — document iOS/Safari rationale inline).
  - `navigator.serviceWorker` message listener for `{ type: "FLUSH_OUTBOX" }` → `flush()`; and `{ type: "CLEAR_OFFLINE_STORAGE" }` → `clearAll()` from `lib/offline/checkin-outbox.ts` (actual wipe happens here, in the page, not in the SW).
  - Best-effort Background Sync: after `enqueue` (subscribe) and on `online`, if `"serviceWorker" in navigator` and a registration exists and `"sync" in registration`, call `registration.sync.register("checkin-outbox")` inside try/catch; Safari/iOS throws or lacks `sync` — swallow silently. Never block the UI on it.
  - Exposes outbox count via the `subscribe` API to the badge component; badge renders only when count > 0: "N absen menunggu sinkron" + link/anchor to `/attendance` if not already there; `role="status"`, `aria-live="polite"`.
  - On `flush()` result with `sessionExpired: true`, badge copy switches to "Masuk lagi untuk menyinkronkan N absen" with a sign-in link (reuse `buildLoginPath` if imported easily, else plain `/login` or `/` link — check `src/lib/security/redirect.ts` and pick the existing helper; do not invent routes).
- Mount it exactly once in the app tree (where `ServiceWorkerRegistration` is mounted), not inside the attendance pages.
- iOS/Safari note as a short comment: no Background Sync; flush happens while app is open.

**Depends on:** T1, T2 (SW `sync`/`message` must exist for the bonus path; the `online` path works without it). **Can run in parallel with:** T3, T4. **Must finish before:** T6.
**Verification.**

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

**Done when** gates green; mounting is a one-line diff in the root layout or the registration component; no auth or `ServiceWorkerRegistration` behavior regression (push path intact).

---

### T6 — Logout wipe: `CLEAR_OFFLINE_STORAGE` at both sign-out call sites

**Goal.** Signing out on a shared device wipes the cached student view and the outbox before navigation completes.

**Both call sites exist today (verified 2026-11-18); plan covers both:**

1. `apps/web/src/components/layout/user-menu.tsx` — the `signOut` helper (line ~45–52) posts `/api/auth/signout`.
2. `apps/web/src/components/profile/account-danger-zone.tsx` — the delete-account path (line ~150) posts `/api/auth/signout` before `router.push("/?account=deleted")`. Note: this file is new/untracked in the parallel-agent pile **but is present on disk and readable**; adding the wipe there is additive to a parallel-owned file — **stop and ask the coordinator before editing this file if it is not owned by this milestone**. If the coordinator declines, the wipe ships only via `user-menu.tsx` and the danger-zone path is listed as a known gap in the milestone report.

**Allowed files.**

- `apps/web/src/components/layout/user-menu.tsx`
- `apps/web/src/components/profile/account-danger-zone.tsx` (with coordinator sign-off per above)
- `apps/web/src/components/pwa/account-wipe.ts` (new tiny client helper, e.g. `wipeOfflineStorage(): Promise<void>`) — optional but preferred to keep both call sites identical

**Deliverables / behavior.**

- On sign-out tap: first `navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_OFFLINE_STORAGE" })` (or via `ready` registration) — best-effort, never awaited indefinitely; the page also calls `clearAll()` directly from `lib/offline/checkin-outbox.ts` (removes outbox + cache stores) and `caches.delete("starstask-offline-static-v1")` if the CacheStorage API is reachable from the window (guard with `typeof caches !== "undefined"`).
- Wipe happens **before** `router.push("/")` so the shared device never renders the next user's session with leftover IndexedDB.
- Both call sites use the same helper. No change to `/api/auth/signout` route itself; no change to server code.
- Verified logout path list (checked 2026-11-18, no other `/api/auth/signout` posters exist): only these two client call sites. If new ones appear before implementation, add them to this task; grep evidence: `git grep -n '"/api/auth/signout"' apps/web/src`.

**Depends on:** T1, T5. **Can run in parallel with:** nothing else in this milestone.
**Verification.**

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

**Done when** gates green; helper is the single wipe implementation; both paths call it before navigation; no other files touched.

---

### T7 — `/attendance` cached read fallback (minimal, client-side)

**Goal.** Visiting `/attendance` with no network renders the student's last saved view from IndexedDB instead of a blank error, without caching any SSR HTML.

**Allowed files.**

- `apps/web/src/app/(workspace)/attendance/page.tsx` (minimal edit only: extract the student render into a client boundary or add an offline wrapper; server data-fetch path unchanged)
- `apps/web/src/components/attendance/attendance-offline-view.tsx` (new client component: reads `readLastView()`; renders `StudentMeetingList` (and static fallback if none) — reuse T3/T4 components, no duplication)
- `apps/web/src/components/attendance/attendance-cache-mirror.tsx` (new client component: mounts on the server page, writes the same payload into `saveLastView({ meetings, identity, activeSessions, ... })` — analogous to T3's meeting mirror; keep in one file, ~60 lines)

**Deliverables / behavior.**

- Server page unchanged for the online path; a client mirror component persists the exact props passed to `ActiveAttendanceSection` (meetings, identity, legacySessions) plus the current student's check-in rows — data **already visible** to this user on this device. Nothing else is stored.
- Offline detection happens **client-side**: the new client boundary shows cached content when `navigator.onLine === false`, or when the server page cannot render dynamic data (build-time `force-dynamic` failure surfaces as a Next error page — this boundary does **not** hook Next error boundaries; it renders a static shell with cached content only after mount when `onLine` is false). Be precise in code comments about this limitation; do not pretend the SW intercepts RSC payloads.
- If no cached view exists, render a simple "You're offline — previously opened attendance will appear here" panel linking to `/offline`; no empty-state lies, no cached personalized HTML, no `select *` style leakage.
- `AttendanceHistorySection`, `CourseAttendanceTable`, metrics: out of scope for offline rendering (L6). Only meetings/identity/active sessions are mirrored.

**Depends on:** T1, T3 (cached view shape), T5. **Can run in parallel with:** T6.
**Verification.**

```bash
cd apps/web
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

**Done when** gates green; server page diff is additive (no logic moved); cached data visible offline after a single online visit (manual check recorded).

---

### T8 — Milestone verifier pass (adversarial)

**Goal.** Fresh-eyes verification of the whole diff before it is declared done.

**Allowed files.** Read-only. No edits. Report-only.

**Checks (all required).**

- `git status --porcelain` diff review against this file's allowed lists; every out-of-list file flagged. Pre-existing parallel-agent files confirmed untouched (see §9).
- Replay POST bodies omit `capturedAt`: grep `git grep -n "capturedAt"` in `apps/web/src` and assert it never appears in an outbox replay construction.
- SW cache allowlist closed: assert unlisted paths (`/api/*`, RSC, arbitrary HTML) are not cached — test evidence from T2 must pass.
- `/offline` is static and contains no personal data (read it).
- Push path intact: `tests/unit/service-worker.test.ts` push tests unchanged and green; `ServiceWorkerRegistration` mount still present in root layout.
- Logout wipe verified in both call sites (or the gap is reported).
- IndexedDB wipe verified post-signout manually on a shared profile.
- All four gates green in `apps/web`: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. If any gate fails only because of pre-existing parallel-agent files, evidence (command output + file list) is attached; no fixes applied to those files.
- No secrets in the diff (`git diff` scanned; `.env*` untouched).

**Verification.** The four gates, re-run, plus the grep evidence above; results pasted in the milestone report. No code changes allowed.

---

## 8. Dependencies and parallelism

```
T1 ──┬──► T3 ──┐
     │         ├──► T5 ──► T6
     └──► T4 ──┘      │
T2 ─────────────► T5  └─► T7 ──► T8
```

- T1 and T2 are fully independent — run concurrently.
- T3 and T4 are independent of each other (different components) but both consume T1's library; the shared `pending-sync-note.tsx` has exactly one creator (T3 or T4 by merge order) — the second imports it.
- T5 needs T1 (outbox) and T2 (SW messages); may overlap T3/T4.
- T6 (logout wipe) needs T1 + T5.
- T7 needs T1 + T3 (+ T5 for consistency of flush-on-mount already provided by the provider).
- T8 last, always.

Suggested execution order: T1 + T2 → T3 + T4 → T5 → T6 + T7 → T8.

Builder count / honesty note: 6–7 working sessions, not one big pass; any agent claiming full completion without running the gates is dishonest.

---

## 9. Parallel-agent safety (binding)

**As of 2026-11-18 `git status --porcelain`, these files are modified or untracked by other agents and MUST NOT be touched, reverted, stashed, or "fixed" by any task above:**

- `apps/web/src/app/(home)/privacy/page.tsx`
- `apps/web/src/app/(workspace)/layout.tsx`
- `apps/web/src/app/(workspace)/lecturer/page.tsx`
- `apps/web/src/app/(workspace)/settings/profile/page.tsx`
- `apps/web/src/app/api/profile/onboarding/route.ts`
- `apps/web/src/components/layout/global-search.tsx`
- `apps/web/src/components/layout/sidebar-profile.tsx`
- `apps/web/src/components/layout/workspace-nav.tsx`
- `apps/web/src/components/layout/workspace-sidebar.tsx`
- `apps/web/src/components/layout/workspace-topbar.tsx`
- `apps/web/src/components/lecturer/*` (all)
- `apps/web/src/components/profile/claim-lecturer-panel.tsx`, `profile-editor.tsx`, `account-danger-zone.tsx` (danger zone is shared — see T6 note; edit only with coordinator sign-off)
- `apps/web/src/features/profile/profile-service.ts`
- `apps/web/src/lib/auth/session.ts`, `apps/web/src/lib/auth/account-state.ts`
- `apps/web/src/lib/lecturer/*`, `apps/web/src/lib/lecturer-today.ts`, `apps/web/src/lib/db/lecturer-attendance.ts`
- `apps/web/src/lib/lecturer/bap-progress.ts`
- `apps/web/tests/e2e/public-pages.spec.ts`
- `apps/web/public/downloads/`, `apps/web/src/app/api/account/`, `apps/web/src/features/account/`
- `apps/web/tests/unit/account-schemas.test.ts`, `account-state.test.ts`, `bap-progress-pace.test.ts`, `lecturer-at-risk.test.ts`, `lecturer-attendance-counts.test.ts`
- `supabase/migrations/20261118150000_fix_onboarding_class_creation.sql`, `20261118160000_account_lifecycle.sql`
- `docs/OFFLINE_ATTENDANCE.md` (owned by the coordinator)

Rules (from `CLAUDE.md` multi-agent coordination, binding):

1. `git status --porcelain` before every edit; if an allowed-file has unexpected foreign changes mid-session, stop and report; do not revert or stash.
2. No `git add -A`; no commits in any task (coordinator commits).
3. No edits to `supabase/`, no migration files, no RPC changes (L1/L2).
4. If build/test is red because of a foreign file, attribute it; do not fix it; leave the file alone.
5. One task = one writer per file at a time; overlapping writes are prohibited.
6. Do not "clean up" adjacent code in an allowed file (e.g. reformat unrelated hunks); keep diffs surgical.

---

## 10. Risks and known limitations (stated plainly)

1. **Stale captures are rejected.** Server time wins (L1/L5). A reading captured offline at 07:00 and synced at 09:30 is out of the attendance window; it lands as `checkin_closed` (terminal) or `late`. This is the accepted price of not trusting device time. Pending-state copy must say so; lecturers see this as an ordinary closed-window rejection. Do **not** work around it with `sync_offline_attendance_meeting` (L2) or client clocks.
2. **Indoor GPS vs the 100 m cap.** Accuracy/radius rejections (`checkin_too_far`, `checkin_imprecise`, 100 m max accuracy) are likely indoors. These are terminal by design (server is truth). UI shows `describeCheckInFailure` text plainly; manual attendance path (class admin) remains the documented fallback.
3. **Background Sync is Chromium-only.** On iOS/Safari, syncing happens only while the app is open (online listener + 30 s foreground interval + reconcile-on-mount). The UI must never promise delivery time. Unsynced entries persist; there is no expiry timer in this phase (entries older than 30 days are rejected by the server anyway if ever replayed as capturedAt, but replay always sends no `capturedAt` — they remain valid-but-likely-`checkin_closed`).
4. **401 while offline.** Session expiry between capture and replay yields HTTP 401; entry stays `pending_sync`, badge shows re-login copy; replay happens after the user signs in again.
5. **Cross-device draft duplication.** Same student tapping Check In on two devices offline creates two entries; the server's `FOR UPDATE` + `already_checked_in` dedupe prevents duplicate rows for the meeting flow; session flow's upsert behaves likewise. `clientRequestId` exists for audit/log correlation, not for server idempotency in this phase.
6. **Shared devices.** Cached view wiped on sign-out (T6); outbox likewise. Residual risk: an entry enqueued but the app is force-killed before any flush — persisted in IndexedDB, survives restart, syncs next open (that is intended).
7. **Anti-cheat honesty.** This feature deters casual tapping, not a determined spoofer with a rooted/emulated device or a VPN-injected GPS. Do not claim fraud-proofing anywhere in copy or docs.
8. **Gate noise from parallel agents.** `pnpm lint` / `pnpm test` / `pnpm build` may be red for foreign reasons; the milestone report must separate pre-existing failures (with file attribution) from introduced ones.
9. **`/offline` is generic.** It carries no session state by design; it may mention that pending check-ins are saved locally, but never shows whose name is queued.
10. **No server-side visibility of pending entries.** Until sync, the lecturer roster does not know the student tapped offline. Communicate that in the pending copy.

---

## 11. Definition of Done (whole milestone)

All of:

- [ ] T1..T7 complete per their task criteria; T8 verifier run with findings recorded.
- [ ] `cd apps/web && pnpm typecheck && pnpm lint && pnpm test && pnpm build` all exit 0, or a failure is explicitly attributed to a foreign file with command output pasted.
- [ ] Replay bodies contain no `capturedAt` (grep evidence).
- [ ] SW allowlist test proves unlisted paths not cached; `sw.js` header comment accurate; push tests untouched and green.
- [ ] `/offline` static and non-personalized; `/attendance` and `/attendance/checkin/[sessionId]` render cached content offline with no cached SSR; `CLEAR_OFFLINE_STORAGE` wired at both sign-out sites (or gap explicitly reported).
- [ ] No changes to `supabase/`, `packages/contracts`, RPCs, or any endpoint other than replay through the two existing check-in routes.
- [ ] No secrets in diff; no files outside allowed lists modified; nothing committed by builders.
- [ ] Milestone report in the coordinator chat lists: per-task results, gate output, manual offline test steps performed (or explicitly deferred with reason), remaining gaps, and attribution of any pre-existing gate failures.
