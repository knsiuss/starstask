# Audit Mobile Native vs Web — 2026-11-09

**Metodologi:** QMS internal-audit style (ISO 13485): *Requirement → Evidence → Gap → Severity*.
severity MAJ = broken/absent yang memblokir pemakaian · MIN = drift parsial · OBS = duplikasi/rapi-rapi.
Scope: `apps/mobile/android/app/src/main/java/id/starstask/mobile/` (182 file `.kt`, ~41,7k LOC)
vs `apps/web/src/app/` + `apps/web/src/lib/db/` + `apps/web/src/components/ui/`.

Kondisi paling penting: **`MainActivity.kt` adalah dead shell** — ia memakai 7-tab lama
(`HOME/CLASSES/ATTENDANCE/ASSIGNMENTS/MESSAGES/MORE/SETTINGS`) dan hanya memanggil
7 screen, jadi mayoritas file screen di bawah tidak terjangkau dari entry point.
`AppDrawer.kt`, `AppNav.kt`, `FloatingNavDock.kt` **tidak dipakai di mana pun**
(klaim `NAVIGATION_DRAWER_ROUTE_MAP.md:36` — “Single NavHost in MainActivity” — tidak terbukti:
tidak ada `NavHost`, tidak ada `navigation-compose` di `app/build.gradle.kts`).

Sedikit catatan positif: `data/*.kt` umumnya sungguhan mengimplementasikan parity backend
(RPC Supabase sama seperti web: `review_leave_request`, `checkInToSession`, E2EE DM, dsb.),
bukan stub. Yang belum beres terutama **wiring navigasi, duplikasi screen, dan token UI yang melebar**.

---

## A. Findings — belum terimplementasi / stub

### MAJ-1 — Entry point tidak memakai drawer/nav yang sudah dibangun
- **Requirement:** `AppNav.kt` enum `DrawerDestination` mengeklaim mapping 1:1 ke
  `workspace-nav.tsx`; `NAVIGATION_DRAWER_ROUTE_MAP.md:36` menyatakan NavHost tunggal di MainActivity.
- **Evidence:** `MainActivity.kt:85` — `enum class Tab(HOME, CLASSES, ATTENDANCE, ASSIGNMENTS,
  MESSAGES, MORE, SETTINGS)`; `StarsTaskApp()` langsung `when(tab)` tanpa NavHost/Drawer;
  `build.gradle.kts` tidak punya `navigation-compose`; `FloatingNavDock`/`AppDrawer` tidak direferensikan
  di luar definisi mereka (grep hanya menemukan komentar di `ScheduleParity.kt:49`).
- **Gap:** 13 destinasi drawer di `AppNav.kt` (Study/Account, dll.) tidak bisa dibuka user;
  bottomBar 5-tab di `FloatingNavDock.kt:41` tidak pernah tampil — yang tampil justru
  `NavigationBar` mentah dengan `icon = { Text(t.label.first()) }` (MainActivity:115) — huruf pertama sebagai ikon.
- **Dampak:** Seluruh screen yg ada *di luar* 7 tab ini effectively dead code dari sudut user.

### MAJ-2 — Screen-screen bermutu tidak terjangkau (orphan dari entry)
- **Requirement:** Setiap screen di `ui/screens/*.kt` harus terreachable.
- **Evidence:** `MainActivity` hanya memanggil `HomeScreen, ClassesScreen, AttendanceScreen,
  AssignmentsScreen, MessagesScreen, MoreScreen, SettingsScreen`. File-file berikut tidak dipanggil
  dari mana pun (termasuk dari `AppDrawer`/`AppNav` yang sendiri tak terpakai):
  `ActionCenterScreen.kt, ProfileScreen.kt, LeaveRequestsScreen.kt, ScheduleScreenNew.kt,
  ClassManageScreen.kt, ClassReportsScreen.kt, SettingsScreens.kt (SettingsHub/NotificationSettings),
  AccountScreens.kt (SecurityPrivacy), AccountFeedback.kt (Feedback), DashboardDetailScreens.kt,
  AttendanceSessionDetail.kt, CourseWorkspaceScreen.kt, AdminConsoleScreens.kt,
  DeveloperConsoleScreens.kt`, dsb.
- **Gap:** Fitur leave-request detail/form, action center, profile, security/E2EE, grades, reports,
  admin/observability — semuanya implemented tapi tak terjangkau.
- **Dampak:** Perilaku user nyata sangat jauh di belakang kemampuan codebase.

### MAJ-3 — Google sign-in native belum berfungsi (dual defect)
- **Requirement:** Credential Manager + Supabase Google provider.
- **Evidence:** Ada **2 implementasi** `signInWithGoogleNative`: (a) `MainActivity.kt:207`
  memakai const lokal `GOOGLE_WEB_CLIENT_ID = "TODO_WEB_CLIENT_ID"` → selalu fallback ke browser OAuth;
  (b) `data/GoogleSignIn.kt:20` memakai `BuildConfig.GOOGLE_WEB_CLIENT_ID`, **tetapi**
  `app/build.gradle.kts` tidak pernah mendefinisikan field itu (hanya `SUPABASE_URL` & `SUPABASE_PUBLISHABLE_KEY`),
  sehingga file (b) secara build-tidak-kompatibel dengan Gradle saat ini; `WelcomeScreen.kt:201`
  memanggil varian (b) — dan `WelcomeScreen` sendiri tidak dipanggil MainActivity (MainActivity menulis
  welcome inline sendiri).
- **Gap:** Login native “dalam aplikasi” (tanpa browser) tidak aktif; fallback browser yang dipakai
  adalah satu-satunya jalur yang bekerja, tapi open-redirect/deep-link `starstask://auth/callback`
  di Manifest benar adanya. Perlu satu sumber kebenaran + `buildConfigField` untuk webClientId.
- **Severity:** MAJ (auth adalah gerbang utama) — tapi fallback browser saat ini menutupi.

### MAJ-4 — FCM service tidak terdaftar di Manifest
- **Requirement:** push notification end-to-end.
- **Evidence:** `StarsTaskMessagingService.kt` ada; `AndroidManifest.xml` hanya berisi
  izin + 1 activity — tidak ada `<service android:name="...StarsTaskMessagingService"
  android:exported="false"><intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT"/>...`
  dan tidak ada `google-services.json` di `app/` (README menyebut disalin manual).
- **Gap:** Firebase Messaging tidak akan diterima saat app background/killed; juga
  `firebase-crashlytics` dideklarasikan tapi tanpa `google-services.json` build gagal di mesin lain.
  `applicationId` namespace-nya `id.starstask.mobile` tapi Supabase project ref di `local.properties` terpisah.
- **Severity:** MAJ untuk push; MIN untuk crashlytics (boleh hilang kalau tak dipakai).

### MAJ-5 — Web parity khusus “settings” hanya lokal (SettingsScreens stub-to-fake)
- **Requirement:** `SettingsScreens.kt:35` — komentar mengakui “Values are local until server sync is wired.”
- **Evidence:** `calendarOn/driveOn/notificationsOn/pluginDone` adalah `remember { mutableStateOf }`
  lokal; Connect/Disconnect tidak memanggil `google_calendar_connections`/`google_drive_connections`
  seperti yang diklaim `NAVIGATION_DRAWER_ROUTE_MAP.md` (“Settings parity”). `feedbackSent` hanya
  menunjukkan “recorded on this device” — server tidak dihubungi. `SettingsHubScreen` di
  `SettingsScreens.kt:62` tampaknya implementasi yang benar, tapi **tidak dipanggil** (MAJ-2); yang terpakai
  dari MainActivity adalah `SettingsScreen` trivial di `MoreScreens.kt:73` (teks + Sign out saja).
- **Gap:** User berpikir sinkronisasi calendar/drive aktif, padahal hanya toggle UI.
- **Severity:** MAJ (fake affordance — langgar “do not fake-implement”).

### MIN-1 — TODO fungsional tersisa
- `CourseWorkspaceScreen.kt:167-168`: `onNewMeeting = { /* TODO: wire createMeeting() */ }`,
  `onShowHistory = { /* TODO: navigate */ }` — tombol render tapi no-op.
- `ScheduleParity.kt:55-64` jujur mendokumentasikan gap: schedule import, drag board, “+N more” overflow dialog,
  lane-based bar chart — semua belum ada (representasi diganti agenda list).
- `ActionCenter.kt:149`: legacy fallback head-count via N+1 row fetches (parity web, tapi mahal).

### MIN-2 — Web routes yang tidak punya counterpart native sama sekali
| Web route | Status native |
|---|---|
| `(site)/login`, `(site)/classes/discover`, `(site)/invite/[token]` | tidak ada; `ClassJoinScreen.kt` ada tapi orphan (MAJ-2) |
| `(site)/classes/[slug]` (public detail) | tidak ada — hanya `ClassDetailScreen` internal |
| `academic/*` (announcements/admins/grades/schedule) | data `AcademicAdmin.kt` ada; UI di `ClassDetailScreen.kt` parsial |
| `settings/branding/calendar/drive` | hanya data `ClassBranding.kt`/`SettingsCalendar.kt`; UI tak terjangkau |
| `admin/*`, `developer/*` (database/logs/security/incidents) | `AdminConsoleScreen/DeveloperConsoleScreen` ada tapi orphan; `DeveloperConsoleScreen` **didefinisikan 2×** (lihat B-1) |
| `sessions/new`, `sessions/[id]/edit` | `NewSessionScreen`/`NewClassSessionScreen` ada tapi orphan/duplikat |
| `assignments/[id]/edit`, `leave-requests/[id]/edit` | `AssignmentEdit.kt` data ada; edit UI tidak terkonfirmasi terjangkau; revise di `MoreFlowsScreens.kt:100` orphan |

### OBS-1 — DOKUMENTASI vs REALITA
- `apps/mobile/README.md` “Status (2026-11-06)” masih bilang screens/OAuth/GPS/push/E2EE “not ported
  yet” — padahal semuanya sudah ada file-nya. README kedaluwarsa 3 hari sebelum terbitnya file-file ini.
- `NAVIGATION_DRAWER_ROUTE_MAP.md` klaim “BUILD SUCCESSFUL ... drawer, NavHost ... 2026-11-08” padahal
  tak ada NavHost di tree. Laporan build itu mungkin dari branch/worktree lain (harness screenshot reference)
  dan tidak ter-merge ke HEAD.
- `LEAVE_REQUESTS.md` bagus dan akurat; `ScheduleParity.kt` terbaik (gap jujur).

---

## B. Duplikasi & Konflik (berantakan struktural)

### MAJ-6 — Definisi screen ganda (same FQ name, package sama)
| Nama | File A | File B | Risiko |
|---|---|---|---|
| `ClassDetailScreen` | `ClassDetailScreen.kt:71` | `DetailScreens.kt:42` | duplikat penuh; mana yg dipakai tak jelas |
| `LeaveRequestFormScreen` | `LeaveRequestFormScreen.kt:51` | `DetailScreens.kt:81` | sama |
| `ScheduleScreen` | `ScheduleScreenNew.kt:78` (637 baris, parity) | `ScheduleLeaveScreens.kt:35` (sederhana) | dua UX schedule berbeda |
| `DeveloperConsoleScreen` | `DeveloperConsoleScreens.kt:42` | `SettingsConsoleScreens.kt:93` | sama, signature beda (`onBack` vs none) |
| `SettingsScreens()` vs `SettingsHubScreen()` vs `SettingsScreen()` | `SettingsConsoleScreens.kt:35` | `SettingsScreens.kt:62` | `MoreScreens.kt:73` | tiga pola settings |
| `AssignmentsScreen` | `WorkspaceScreens.kt:49` (lama, sederhana) | `AssignmentsScreen.kt:67` (`AssignmentsWorkspaceScreen`) | MainActivity memanggil yg lama |
| `MessagesScreen`/`NotificationsScreen`/`SessionsScreen` | `WorkspaceScreens.kt:92,125` & `MoreScreens.kt:35` | — | versi lama yang dipanggil MainActivity adalah yg paling sederhana |

Di Kotlin kedua definisi tak bisa hidup berdampingan dalam package sama — satu di antaranya
pastinya tidak terkompilasi/termasuk build, atau build terakhir gagal membawa semua file.
Perlu verifikasi dengan `./gradlew :app:compileDebugKotlin` di HEAD sekarang.

### MIN-3 — Berkas “extra/clean/legacy” menumpuk
- `WorkspaceScreens.kt`, `MoreScreens.kt`, `DetailScreens.kt`, `ScheduleLeaveScreens.kt`,
  `SettingsConsoleScreens.kt`, `HomeScreenshotSections.kt`, `CourseAttendanceClean.kt`,
  `AttendanceCheckInExtra.kt`, `Dashboard*` (4 file), `Home*` (12 file), `LeaveForm*` (5 file),
  `EventForm*` (2 file) — pemisahan per file tidak konsisten: ada file 626-barik (`CourseWorkspaceScreen.kt`),
  748-barik (`ActionCenterScreen.kt`) dan `Workspace.kt` data 826 baris / `AttendanceStudent.kt` 781 baris.
  Sebagian besar pecahan ini (Home 12 file, LeaveForm 5 file, dsb.) terlihat hasil split mekanis
  per-section, bukan per-responsibility — memperberat navigasi tanpa menambah clarity.
- `WebUi.kt` (239) vs `WebFields.kt` (235) vs `WebTabStrip.kt`(73) — tiga file komponen mirip web;
  pemisahan `WebFields`/`WebUi` tidak beralasan (keduanya expose `Web*` primitives).

### MIN-4 — Dua jalur navigasi & splash (3 varian entry)
`SplashScreen.kt`, `WelcomeScreen.kt`, `GoogleAccountChooser.kt`, `DevBypassWelcome.kt`
semuanya tidak dipanggil MainActivity. MainActivity membangun welcome inline (150-190).
DevBypass (`data/DevBypass.kt` + `DevBypassWelcome.kt`) adalah jalur pintas login yang tersisa
di codebase produksi — harus dihapus / di-flag debug saja.

---

## C. UI berantakan / beda dari web

### MAJ-7 — Tiga sistem desain hidup bersamaan (token divergence)
- **Web kanonis** (`apps/web/src/app/globals.css`): `--color-background #fafaf8`,
  `--color-foreground #292d34`, `--color-accent #45639e`, radius 6/8/12/16dp, Inter.
- **Mobile global** (`Theme.kt`): sama persis untuk token *sekarang* — bagus.
- **Tapi** di `Theme.kt` yang sama sudah muncul 2 set token lain yang di-scope per-fitur:
  `AssignmentBackground #F7F8FA / AssignmentAccent #526B9F / AssignmentRadiusCard 20dp` dan
  `AttendanceBackground #F7F8FC / #111936 / #2563EB / AttendanceRadiusCard 20dp`.
  Artinya Assignments dan Attendance **secara desain sengaja tidak sama dengan web** —
  radius 20 vs 12, accent beda (`#526B9F`/`#2563EB` vs `#45639e`), ink beda.
  Ini akar “beda dari web” yang terlihat user.
- **Apalagi** banyak warna liar di screen-level (bukan dari token):
  `0xFFB85454, 0xFFC43B4A, 0xFFB42318, 0xFF2E7D4F, 0xFFF59E42, 0xFFC98A2E, 0xFFE6FFE8C8, 0xFFFBF8F0...`
  (hitung: >30 nilai unik di luar token resmi; 32× `0xFFE9EBF0` di Assignments saja).
  Web membatasi di ~20 token; mobile sudah > 50.

### MAJ-8 — BottomBar/Dock & drawer kaos
- Dua implementasi navigasi: (1) `NavigationBar` + huruf-di-ikon di MainActivity;
  (2) `FloatingNavDock` (terbaik, bottomBar 5-tab) — tidak terpakai.
- `AppDrawer` (ModalNavigationDrawer + grup study/leader/campus/account) selesai & bagus
  di atas kertas, tapi tidak terpakai → user mobile tidak punya hamburger drawer sama sekali.
- Tab label tidak konsisten: enum drawer `MESSAGES` = “Messages” sedangkan bottomBar MainActivity
  “Chat”; drawer `LEAVE` = “Leave Requests”/bottomBar “Absence” vs web “Absence Requests” —
  tiga nama untuk satu halaman. Drawer doc bilang “bottom bar keeps Absence per reference”,
  MainActivity tidak punya bottomBar itu.

### MIN-5 — Ikon & tipe
- Ikon: `Lucide.kt` (outline) + `IosIcons.kt` + `IosTabBold.kt` (filled/bold untuk tab) +
  `HomeIcons.kt` — empat sumber ikon; tab yang aktif memakai bold sehingga melanggar prinsip
  “active via pill, not filled glyph” di komentar `AppNav.kt`.
- Emoji di string user-facing: `MoreScreens.kt:41,55` memakai `🔒` — melanggar aturan global
  “NO emoji di UI code”. Perlu diganti Lucide `Lock` icon.
- Tipografi: `inter.ttf` resmi di `res/font/` — bagus; tapi beberapa screen lama
  (`WorkspaceScreens.kt`) memakai `headlineSmall` Material default, bukan token web.
- `ClassDetailScreen.kt` (636) / `CourseWorkspaceScreen.kt` (618) / `ScheduleScreenNew.kt` (637) /
  `ActionCenterScreen.kt` (748) / `ProfileScreen.kt` (634): file > 300 baris — langgar batas 300
  di Bagian 5.6 AGENTS.md; `Workspace.kt` 826 & `AttendanceStudent.kt` 781 lebih parah di data layer.

### MIN-6 — Status states tidak konsisten
- Web memakai `Skeleton/EmptyState/Alert` terpusat; mobile punya `WebEmptyState` (WebFields:201)
  dan `AssignmentEmptyState` (ExploreAssignmentCard:36), `LeaveEmptyState` (LeaveRequestsCards:129).
  Tiga implementasi empty-state berbeda. Loading: teks “Loading…” polos di screen lama,
  `WebSkeleton` hanya di sebagian screen baru.
- `LoadingOrEmpty` di `WorkspaceScreens.kt:37` adalah mini-framework sendiri.
- Pull-to-refresh: `PullToRefresh.kt` ada; tidak semua list screen memakainya konsisten.

### MIN-7 — Pola “Web mirror” belum lengkap
Web `components/ui/` punya 15 primitif: alert, badge, button, card, dialog, dropdown-menu,
input, label, pull-to-refresh, select, skeleton, tab-strip, textarea, theme-toggle, toast.
Mobile hanya memetakan: card/badge/button (WebUi), input/textarea/skeleton/empty/alert (WebFields),
tab-strip, pull-to-refresh. **Belum dipetakan:** dialog (masih `AlertDialog` Material mentah di
AssignmentsDialogs/EventDialogs), dropdown-menu, select (masih DropdownMenu material), label,
theme-toggle (ada toggle tapi tidak konsisten), toast (snackbar material). Setiap screen tanpa
standardisasi ini akan terlihat berbeda dari web, dan screen lama (WorkspaceScreens) bahkan tidak
memakai WebUi sama sekali (Card + OutlinedButton Material mentah, radius 12dp hardcoded).

### OBS-2 — Hal-hal yang sebenarnya sudah cukup baik
- Token global `Theme.kt` + `Spacing` object sudah menjadi satu-satunya sumber dp — praktik bagus,
  tinggal hapus token per-fitur (Assignment/Attendance) dan ganti ke sumber tunggal.
- `WebUi/WebFields` vs `card/badge/button/skeleton.tsx` memiliki parity niat yang tepat.
- `ScheduleParity.kt`, `LEAVE_REQUESTS.md`, `NAVIGATION_DRAWER_ROUTE_MAP.md` adalah dokumentasi
  terbaik di repo ini — tinggal selaraskan dengan realita kode (NavHost).

---

## D. Ringkasan parity fitur web → mobile

| Domain | Web | Mobile data (`data/*.kt`) | Mobile UI terjangkau | UI implemented tapi orphan |
|---|---|---|---|---|
| Dashboard (`/app`) | ✅ | ✅ `DashboardRepository` | ⚠ `HomeScreen` (785+ file split) | ✅ |
| Assignments | ✅ | ✅ lengkap | ⚠ lama polos `WorkspaceScreens` | ✅ `AssignmentsScreen.kt` lengkap |
| Attendance/check-in | ✅ | ✅ lengkap + offline queue | ⚠ `AttendanceScreen` old | ✅ session detail, course workspace |
| Schedule/calendar | ✅ | ✅ `Calendar` setara web | ❌ (tab “More” → Attendance) | ✅ `ScheduleScreenNew` terbaik |
| Leave requests | ✅ | ✅ lengkap (status/validasi) | ❌ | ✅ semua screen |
| Messages E2EE | ✅ | ✅ `DmCrypto/DmChat` | ⚠ list saja, “encrypted” tanpa baca | ⚠ detail chat tidak dipanggil |
| Notifications | ✅ | ✅ `NotificationSettings` | ⚠ `WorkspaceScreens.NotificationsScreen` polos | ✅ detail screen orphan |
| Settings | ✅ | ⚠ sebagian lokal (MIN) | ❌ (`SettingsScreen` trivial) | ✅ `SettingsHubScreen` |
| Profile/security | ✅ | ✅ | ❌ | ✅ lengkap |
| Action center | ✅ | ✅ | ❌ | ✅ 748 baris |
| Admin/developer | ✅ | ✅ `AdminConsole/DeveloperConsole` | ❌ | ✅ |
| Onboarding/invite/join | ✅ | ✅ `Invitations` | ❌ | `ClassJoinScreen`, `OnboardingScreen` |
| Public landing / discovery | ✅ | — | ❌ | — (disengaja? tidak ada layar native) |

---

## E. Rencana perbaikan (prioritas)

### P0 — Bereskan entry point (1-2 hari kerja)
1. Putuskan arsitektur navigasi: **pakai NavHost + AppDrawer + FloatingNavDock** (yang sudah dibangun)
   atau hapus ketiganya dan perluas enum `Tab` di MainActivity. Yang sekarang: dua-duanya setengah jadi.
   Preferensi: NavHost — drawer route-map sudah jadi kontrak produk.
2. Sambungkan NavHost ke 13 `DrawerDestination` + deep-link `starstask://auth/callback` +
   argument untuk `UserId` dassana. Perlu tambah dependency `navigation-compose` ke `app/build.gradle.kts`.
3. Hapus welcome/splash inline dari MainActivity; pakai `WelcomeScreen`/`SplashScreen` yang ada.
4. Daftarkan `StarsTaskMessagingService` di Manifest; sediakan `google-services.json.example`
   dan mekanisme `BuildConfig.GOOGLE_WEB_CLIENT_ID` + hapus duplikasi `signInWithGoogleNative` di MainActivity.
5. Verifikasi build sekarang: `./gradlew :app:assembleDebug` — konflik duplikat nama (B-1) harus
   diselesaikan dulu sebelum mengintegrasikan NavHost.

### P1 — Hapus duplikat (setengah hari - 1 hari)
6. Hapus `WorkspaceScreens.kt`, `MoreScreens.kt` (versi lama), `DetailScreens.kt`,
   `ScheduleLeaveScreens.kt`, `SettingsConsoleScreens.kt` — pindahkan entry point yang benar di
   `HomeScreen`/`AssignmentsScreen.kt`/`ScheduleScreenNew.kt`/dst. ke NavHost.
7. Hapus `DevBypass.kt`/`DevBypassWelcome.kt` dari build produksi (atau guard `BuildConfig.DEBUG`).
8. Ganti `🔒` dengan Lucide `Lock`; perbaiki label konsisten: pilih “Leave Requests” **atau**
   “Absence Requests” dan pakai di drawer, bottomBar, dan web — bukan tiga varian.

### P2 — Satukan design token (1-2 hari)
9. Hapus `Assignment*` / `Attendance*` token di `Theme.kt`; migrasi screen-nya ke token global.
10. Sweep warna liar (`grep 0xFF` di `ui/screens/`) ke token; target ≤ 25 warna unik (sama seperti web+dark).
11. Lengkapi `ui/components`: tambah `WebDialog`, `WebSelect`, `WebDropdownMenu`, `WebToast`,
    `WebThemeToggle` untuk parity 15 primitif web; migrasi `AssignmentsDialogs`/`EventDialogs`.
12. Standarkan `EmptyState`/`Skeleton`/`PullToRefresh` — hapus `AssignmentEmptyState`/`LeaveEmptyState`/
    `LoadingOrEmpty` lokal dan pakai `WebEmptyState`.

### P3 — Pecah file besar & honest stubs (berikutnya)
13. Pecah >600 file screen (`ActionCenterScreen`, `CourseWorkspaceScreen`, `ScheduleScreenNew`,
    `ProfileScreen`, `ClassDetailScreen`) — maks 300 baris/file sesuai AGENTS.md §5.6.
14. Pecah `data/Workspace.kt` (826) & `data/AttendanceStudent.kt` (781) per repository concern.
15. `CourseWorkspaceScreen.kt:167` — wire `createMeeting()` dan navigasi history; atau sembunyikan tombol.
16. `SettingsScreens()` lokal → ganti dengan `SettingsHubScreen` + server sync; hapus toggle “DataSink”
    yang menyesatkan; feedback wajib server.
17. Setelah semua, revisi `README.md` Status + `NAVIGATION_DRAWER_ROUTE_MAP.md` agar jujur
    terhadap tree HEAD; jalankan `scripts/audit` QMS jika ada.

---

## F. Metric

| Metrik | Target | Aktual (2026-11-09) |
|---|---|---|
| Screen terjangkau dari entry | 100% | ~15% (7 dari >50 fungsi Screen) |
| Duplikat definisi | 0 | ≥ 8 fungsi nama sama |
| Token warna unik (mobile) | ≤ 25 | > 50 (termasuk 2 set token per-fitur) |
| File > 300 baris | 0 (baru) | ≥ 12 |
| Web UI primitives parity | 15/15 | ~9/15 |
| TODO/fake placeholder | 0 | 2 di CourseWorkspace + SettingsServers lokal |
| FCM terdaftar | Ya | Tidak |
| Google native login aktif | Ya | Tidak (fallback browser) |

---

*Audit disusun mengikuti format ISO 13485 internal audit: Requirement → Evidence → Gap → Severity.
File-file yang dirujuk memakai path relatif terhadap repo root.*
