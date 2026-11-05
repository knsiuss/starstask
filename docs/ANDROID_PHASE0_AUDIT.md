# Android Phase 0 Audit — StarsTask Mobile (Capacitor)

Date: 2026-11-06. Status: audit only, no code changed.
Labels: **VERIFIED** (observed in repo) / **INFERRED** (structure suggests) /
**NOT VERIFIED** (needs device/emulator or credentials).

## 1. Existing architecture map

| Layer       | Reality (VERIFIED)                                                                                                        | Evidence                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Web app     | Next.js 16, App Router, RSC-first, `force-dynamic` everywhere                                                             | `apps/web/src/app`, `docs/PERFORMANCE-AUDIT.md:36`            |
| Mobile app  | Separate minimal Vite + vanilla TS shell (`apps/mobile/src/main.ts`, 280 lines), **not** the Next.js app                  | `apps/mobile/package.json`, `src/main.ts`                     |
| Backend     | Supabase (PostgREST + RPC + Auth + Storage), shared by web and mobile shell                                               | `apps/mobile/src/lib/supabase.ts`                             |
| E2EE DM     | Web only (`apps/web/src/lib/crypto/e2ee.ts`, WebCrypto). Mobile shell has no DM code at all                               | grep `e2ee                                                    | crypto`in`apps/mobile/src` = 0 |
| Push        | FCM via `@capacitor/push-notifications` + `native_push_tokens` table + server scheduler (`FIREBASE_SERVICE_ACCOUNT_JSON`) | `apps/mobile/README.md:48-56`, `native_push_tokens` migration |
| Crashlytics | Native via Firebase BOM 35.1.0, enabled in `MainActivity`; google-services plugin applied conditionally                   | `android/app/build.gradle`, `MainActivity.java`               |
| Offline     | Check-in queue only (`lib/offline-queue.ts`, localStorage). No cached data reads, no sync engine                          | `apps/mobile/src/lib/*`                                       |

**Critical finding:** `docs/ANDROID_ROADMAP.md` decided "Web app is the
single source of UI; mobile must not fork code" — in practice the mobile
shell is an independent mini-app (dashboard, GPS check-in, attachment
upload) that duplicates web logic. The Next.js app has **no static
export** (all pages `force-dynamic`, 113 API routes, server components
with cookies), so it cannot be bundled into Capacitor as-is. Any
"web updates reach Android without a store release" plan therefore only
covers the mobile shell bundle, not the web app.

## 2. Current Android initialization flow

1. `Capacitor` native: `MainActivity` (BridgeActivity) → transparent
   status bar, Crashlytics enabled.
2. WebView loads `dist/index.html` (Vite build of the shell, local
   bundled — no `server.url` in `capacitor.config.ts`).
3. `main.ts`: render loading → `getSession()` → signed-in dashboard or
   Google sign-in button.
4. Google sign-in leaves the WebView via Custom Tab (`@capacitor/browser`),
   returns via custom-scheme deep link `id.starstask.mobile://`, PKCE
   exchange (`lib/auth.ts`).
5. On session: register FCM token → `POST /api/push/native-token`;
   sync queued check-ins.

## 3. Capacitor configuration analysis

- `appId id.starstask.mobile`, `webDir: dist`, `allowMixedContent: false`,
  SplashScreen + PushNotifications presentation configured.
- **Missing:** no Live Update (Capgo) despite Roadmap Fase 1 deciding it;
  no Network/Keyboard/Filesystem/StatusBar plugins; no `server.url`
  dev config; iOS contentInset only.

## 4. Connector inventory

| Connector                                   | Status                      | Notes                                                                                                |
| ------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| PushNotifications (FCM)                     | Implemented, token → server | Foreground/background/tap handling is `console.log` only (`main.ts:232-236`) — tap does not navigate |
| Geolocation                                 | Implemented                 | Permission + high accuracy; 100 m accuracy gate                                                      |
| Browser (Custom Tab OAuth)                  | Implemented                 | Custom scheme deep link; App Links not done (roadmap acknowledges)                                   |
| App (back button, appUrlOpen)               | Implemented                 | Back → history/exit                                                                                  |
| SplashScreen                                | Configured                  | Auto-hide                                                                                            |
| local-notifications                         | Installed, unused in `src`  | No usage found                                                                                       |
| Network / Keyboard / Filesystem / StatusBar | Not installed               | Status bar handled manually in `MainActivity`                                                        |
| Crashlytics                                 | Native enabled              | No JS error bridge, no version/environment tagging in shell                                          |

AndroidManifest (VERIFIED partial): only `INTERNET` permission found in
the shown section; `POST_NOTIFICATIONS` and location permissions need a
full recheck before release (NOT VERIFIED whether plugin merges add them).

## 5. Offline capability inventory (today)

| Feature                          | Offline state                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| App launch                       | Works (local bundle), but dashboard data fetch fails → bare error text, no cached view |
| Check-in                         | Queued in localStorage, synced on `online` event + startup                             |
| Assignments / schedule / classes | Not cached — empty/error offline                                                       |
| Attachment upload                | Online only                                                                            |
| DM / E2EE                        | Not present in mobile app                                                              |

Queue gaps: no exponential backoff, no idempotency key beyond the
server RPC rejecting duplicates, localStorage can be evicted by the
WebView, no encryption at rest, no logout cleanup, no sync status UI,
sync triggers only on `online`/startup.

## 6. E2EE compatibility assessment

- Web: AES-GCM via WebCrypto (`lib/crypto/e2ee.ts`), ciphertext on
  server, keys in IndexedDB — sound design, untouched by this audit.
- Mobile: no E2EE code; WebView (Chromium) does support
  `crypto.subtle`, so a future port is feasible without a second crypto
  implementation — but it must reuse the exact wire format and key
  storage, and offline DM is a separate problem from offline CRUD.
- Not verified on a real device WebView (NOT VERIFIED).

## 7. Identified bugs and risks

1. **Shell/web drift (HIGH):** roadmap principle violated; mobile will
   diverge from web features (DM, leave, beta, etc. absent).
2. **Live updates absent (MEDIUM):** Capgo decided but not installed;
   every shell change needs a store release.
3. **Push tap does nothing (MEDIUM):** notification tap only logs; no
   deep-link navigation to the message/session.
4. **innerHTML rendering (MEDIUM):** `main.ts` builds DOM from server
   strings via `innerHTML` — user-controlled names/titles are not
   escaped at the template level (mitigated only by Supabase data
   shapes; still a stored-XSS surface worth fixing with textContent).
5. **Offline queue fragility (MEDIUM):** localStorage eviction, no
   backoff/visibility, no logout wipe (academic check-in data +
   identity NIM persist after logout).
6. **Auth deep link security (LOW now):** custom scheme can be claimed
   by another app; App Links required before public release.
7. **No mobile tests (MEDIUM):** `apps/mobile` has no test script;
   QA scenarios in the brief cannot be regression-gated.

## 8. Recommended implementation strategy (smallest safe path)

### Phase 1 status (implemented 2026-11-06)

- Push tap now opens the notification destination in a Custom Tab
  (internal paths only, origin from `VITE_API_BASE_URL`).
- All dashboard interpolations in `main.ts` are HTML-escaped.
- `AndroidManifest.xml` declares `POST_NOTIFICATIONS`,
  `ACCESS_FINE_LOCATION`, and `ACCESS_COARSE_LOCATION` explicitly.
- Global JS error/unhandled-rejection handlers log structured entries
  (no tokens/PII at call sites). A native Crashlytics JS bridge is
  still missing — logged errors are visible in Logcat, not yet in the
  Crashlytics dashboard.
- Remaining Phase 1 item: verify merged manifest permissions and FCM
  tap on a real device/emulator (needs Android SDK + build).

1. **Phase 1:** fix initialization bugs first — push tap navigation,
   innerHTML escaping, `POST_NOTIFICATIONS` + location permission audit,
   JS error → Crashlytics bridge.
2. **Phase 2:** offline foundation — move queue to a durable store
   (IndexedDB via Dexie or Capacitor Filesystem), add backoff + sync
   status + logout wipe; cache dashboard reads with timestamps.
3. **Phase 3:** Capgo Live Update for the shell bundle only, with
   bundled fallback + rollback; document clearly that Next.js web
   changes still ship via web deploy, not via the APK.
4. **Phase 4:** connector hardening (FCM lifecycle, token refresh,
   permissions rationale).
5. **Phase 5:** mobile UI pass (touch targets, safe areas, offline
   indicators) reusing web tokens where the shell renders.
6. **Phase 6:** device QA matrix from the brief + release runbook.

Explicitly out of scope: React Native/Expo migration, replacing
auth/E2EE/FCM/Crashlytics, moving API routes to Edge Functions.
