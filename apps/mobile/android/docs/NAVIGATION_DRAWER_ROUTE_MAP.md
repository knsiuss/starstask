# StarsTask Android — Navigation Drawer Route Map

Native drawer (`ui/components/AppDrawer.kt`, `ui/navigation/AppNav.kt`) mirrors
the web workspace sidebar (`apps/web/src/components/layout/workspace-nav.tsx`)
1:1. Web routes, backend identifiers, and permissions are unchanged; Android
labels follow product naming ("Leave Requests", not "Absence Requests").

| Drawer group | Android label | Native route | Web route | Native destination |
|---|---|---|---|---|
| Study | Dashboard | `dashboard` | `/app` | `HomeScreen` |
| Study | Assignments | `assignments` | `/assignments` | `AssignmentsWorkspaceScreen` (+ detail drill-down) |
| Study | My Classes | `classes` | `/classes` | `ClassesScreen` |
| Study | Attendance | `attendance` | `/attendance` | `AttendanceScreen` (+ course/session drill-down) |
| Study | Schedule | `schedule` | `/schedule` | `ScheduleScreen` |
| Study | Leave Requests | `leave-requests` | `/leave-requests` ("Absence Requests" on web) | `LeaveRequestsScreen` |
| Study | Messages | `messages` | `/messages` | `MessagesScreen` |
| Study | Notifications | `notifications` | topbar bell (no sidebar destination on web) | `NotificationsScreen` |
| Class leader | Action Center | `action-center` | `/app/actions` | `ActionCenterScreen` (4 tabs) |
| Campus | University Info | `university-info` | `/university-info` | `UniversityInfoScreen` |
| Account | Profile | `profile` | `/settings/profile` | `ProfileScreen` |
| Account | Settings | `settings` | `/settings/notifications` | `SettingsHubScreen` + `NotificationSettingsScreen` |
| Account | Security & Privacy | `security` | `/settings/security` | `SecurityPrivacyScreen` (E2EE parity) |
| Account | Feedback | `feedback` | `/settings/feedback` | `FeedbackScreen` |

## Permissions

- Study + Account groups require authentication (drawer only renders after
  Google sign-in; unauthenticated users see the welcome screen).
- Class leader section renders only when `getWorkspaceScope(userId).managesAnyClass`
  is true — the same `class_admins` gate web uses (`isClassAdminAnywhere`).
  `ActionCenterScreen` re-verifies via `getWorkspaceScope` instead of trusting
  navigation state.

## Navigation architecture

- Single `NavHost` in `MainActivity` (`StarsTaskApp`). Drawer and bottom bar
  navigate through the same `NavController` with `launchSingleTop` +
  `restoreState`; active state is derived from the current back-stack destination.
- Bottom bar shows the 5 primary tabs (Dashboard, Assignments, Attendance,
  Schedule, Leave) — same destinations as the drawer's Study group.
- `ModalNavigationDrawer` provides scrim, slide-in, outside-tap close, and
  Android back-button dismissal via `BackHandler`. Drawer content respects
  status/nav bar insets (`statusBarsPadding` / `navigationBarsPadding`).
- Top app bar keeps notification bell, theme toggle, messages, and account
  actions; hamburger opens the drawer on every primary screen.

## Action Center stages (documented, no fake tabs)

- Stage 1: managed classes + pending submission-review counts via
  `getWorkspaceScope` + `listManagedRequests` (same loaders as Assignments).
- Stage 2 (implemented): Overview / Leave / Attendance tabs.
  - Leave: managed queue (`leave_requests` scoped to managed class ids,
    drafts excluded) with Approve / Reject / Request-revision decisions
    via the same `review_leave_request` RPC the web service uses; notes
    follow the web rule (reject/revision need ≥3 chars).
  - Attendance: sessions for managed classes from `discussion_sessions`
    (same table the Schedule screen uses); session management itself
    lives in the Attendance tab.
- Assignments review reuses the Assignments workspace screen.

## Security & Privacy (E2EE parity with web)

Web: `SecurityPrivacyPanel` + `lib/crypto/{e2ee,key-backup}.ts` +
`/api/dm/keys/me`. Native (`data/DmKeys.kt` + `SecurityPrivacyScreen`):
ECDH P-256 keypair per device (private half in app-private prefs, the
native analogue of IndexedDB), public key published to `dm_keys`,
safety fingerprint (SHA-256 of base64 key, hex grouped by 4, 29 chars),
backup/restore via passphrase (PBKDF2-HmacSHA256 600k + AES-GCM,
`v2:600000:salt:iv:cipher` in `dm_key_backup`). Restore accepts web's
legacy 100k format too, so backups are interchangeable with web.
Sections mirror web: End-to-end encryption / This device / Backup &
recovery / Devices & sessions. No WebView anywhere.

## Settings (parity with web /settings/*)

- `SettingsHubScreen`: Notification settings entry + Calendar / Drive
  connection status read from `google_calendar_connections` /
  `google_drive_connections` (same non-sensitive columns web reads).
  Connect opens the same server `start` route the web settings page uses,
  in a Custom Tab (no WebView): the confidential OAuth client + token
  storage stay server-side, so consent runs in the browser and the grant
  is stored by the server; the native screen refreshes the same tables.
  Requires `starstask.site.url` in `android/local.properties`.
- `NotificationSettingsScreen`: `notification_preferences` toggles
  (push, assignment 24h/3h, session 24h/3h) + timezone, saved with the
  same update-then-insert rule as web (RLS allows UPDATE on preference
  columns only). Enabling push registers the FCM token via
  `register_native_push_token` (platform `android`); disabling removes
  it via `delete_native_push_token`.

## Campus (University Info + Plugins)

- Drawer `CAMPUS` section → `UniversityInfoScreen` (web `/university-info`):
  persisted UNPAM `plugin_events` with kind tabs (Kalender / MENTARI /
  Pengumuman), program filter, text search, and official source links.
  Section renders only for UNPAM members (`isUnpamMember` via
  `university_memberships`), mirroring web's `showUniversityInfo` flag.
- `settings/plugins` route → `PluginsScreen` (web `/settings/plugins`):
  read-only plugin status for platform admins (event count + last sync
  from `plugin_events`); the toggle is env-driven server-side, same as web.

## Build verification

- `:app:compileDebugKotlin` (2026-11-08): **BUILD SUCCESSFUL** for the whole
  `:app` module — drawer, NavHost, account screens, action center, E2EE,
  notification settings, university info, and plugins all compile together
  with the rest of the app. (Verified with an isolated Gradle user home
  because parallel builds in this repo share the default one.)
- Web-UI restyle (2026-11-08): shared `ui/components/WebUi.kt` mirrors
  `apps/web/src/components/ui/{card,badge,button}.tsx` (surface + border
  + rounded-lg/p-5 card, pill soft-tone badges, rounded-md buttons) and is
  applied to Action Center, Security & Privacy, Feedback, Settings hub,
  and University Info. Drawer label corrected to "Leave Requests"
  (bottom bar keeps "Absence" per reference), placeholder icons replaced
  with outline equivalents, Inter typeface (web `--font-inter`).
- `navigation-compose:2.9.3` resolves (cached in Gradle modules-2:
  `navigation-compose-android/2.9.3`, `navigation-common-android/2.9.3`,
  `navigation-runtime-android/2.9.3`).
- Visual parity: drawer rendered on emulator (Medium_Phone_API_37.0, API
  37) from the HEAD worktree harness (`DrawerShotActivity`, temporary and
  not shipped) — see [drawer-parity-final.png](drawer-parity-final.png):
  Inter typeface, white surface, compact header with logo + "Academic
  workspace" + close, STUDY / CLASS LEADER / CAMPUS / ACCOUNT groups,
  outline icons (grid, clipboard, cap, person-add, calendar, chat,
  check-circle, gear), "Leave Requests" selected with soft-blue
  background and blue text/icon — matching the supplied reference
  screenshot.
