# Perbandingan Detail Web → Mobile: Apa yang Belum Diimplementasi?

**Sumber:** `apps/web/src/app/` (97 `page.tsx`, 169 `route.ts` API) vs
`apps/mobile/android/app/src/main/java/id/starstask/mobile/` (`data/*.kt` 57 file, `ui/screens/*.kt` ~120 file).
**Legenda:** ✅ sudah | ⚠️ sebagian/orphan (implemented tapi tak terjangkau) | ❌ belum ada.

Catatan pelan-pelan: “implemented” di sini mencakup dua lapisan — **data layer**
(`data/*.kt`, RPC Supabase yang sama seperti web) dan **UI layer** (`ui/screens/*.kt`).
Ada hal yang datanya sudah lengkap tapi UI-nya tak terjangkau entry point — saya bedakan
di tabel supaya jelas yang mana yang benar-benar harus ditulis baru vs yang tinggal disambungkan.

**Kalibrasi severity** (menyesuaikan klausul 8 QMS):
- **MAJ** = fitur hilang/pecah yang memblokir pemakaian inti.
- **MIN** = sebagian, drift, atau UI dangkal.
- **OBS** = catatan / duplikasi / dokumentasi.

---

## 1. Quick-win (implementasi ada, hanya tak terjangkau)

Delapan kelompok ini **tidak perlu ditulis ulang** — hanya disambungkan ke `MainActivity`/NavHost:

| Fitur | Data | UI | Kenapa tak terlihat |
|---|---|---|---|
| Action Center (overview/leave/attendance) | ✅ `ActionCenter.kt` | ✅ `ActionCenterScreen.kt` (748 baris) | tak ada di enum `Tab` MainActivity |
| Profile + Security (E2EE backup/restore) | ✅ `DmKeys.kt` | ✅ `ProfileScreen.kt`, `AccountScreens.kt` | sama |
| Leave Requests lengkap (form/detail/review/forward) | ✅ `LeaveRequests*.kt`, `LeaveForwarding.kt` | ✅ 10+ file Leave* | sama |
| Schedule (week/month/list parity) | ✅ `Calendar*.kt` | ✅ `ScheduleScreenNew.kt` (637) | terlempar ke tab lebih tua di `MoreScreen` |
| Assignments workspace | ✅ lengkap | ✅ `AssignmentsScreen.kt` | MainActivity memanggil versi lama di `WorkspaceScreens.kt` |
| Settings Hub + Notifications + Integrations | ✅ | ✅ `SettingsScreens.kt` | yang dipakai hanya `SettingsScreen` trivial |
| Grades | ✅ `Grades.kt` | ✅ `GradesScreen.kt` | orphan |
| Admin/Developer consoles | ✅ | ✅ | orphan + definisi ganda |

Ini satu-satunya bagian yang bisa selesai dalam 1 sprint tanpa menambah fitur baru.

---

## 2. MAJ — belum ada sama sekali

### 2.1 Public / entry-surface: landing, login, onboarding, discover, invite, download
- Web: `(home)/page.tsx` (hero, feature strip, how-it-works, FAQ, subject grid, mission),
  `(site)/login`, `(site)/classes/discover`, `(site)/invite/[token]`, `(onboarding)/onboarding`,
  `d/[token]` + `api/d/[token]/download`.
- Mobile: tidak ada landing native (WelcomeScreen inline di MainActivity, bukan landing).
  `ClassJoinScreen.kt` & `OnboardingScreen.kt` (di `DetailScreens.kt:142`) dan `Invitations.kt`
  implementasi ada tapi orphan; `download` publik tidak ada.
- Dampak: user tanpa akun tidak punya *glance at the product*; link invite web tidak bisa dibuka di app.

### 2.2 Schedule admin: import OCR + AI-vision + drag + overflow
- Web: `api/classes/[slug]/schedule/import`, `lib/ocr/schedule-parse.ts`, `attendance-sheet-parse.ts`,
  `ai-vision.ts` (transkripsi timetable via LLM multimodal, confirm-preview), `lib/schedule/timeline.ts`
  (lane-based bar chart), weekly board drag, “+N more” overflow dialog.
- Mobile: `ScheduleParity.kt:60` mengakui gap ini; tidak ada `Ocr`, tidak ada AI vision; DOM
  “list agenda saja” menggantikan bar chart; import = 0 baris.
- Dampak: dosen/admin yang migrasi jadwal KHS dari PDF/photo masih harus input manual per slot.

### 2.3 Attendance paper/OCR + sheet codes
- Web: `AttendancePaperImport` (`lib/ocr/attendance-sheet-parse.ts` — match NIM dari lembar tercetak),
  `lib/attendance/sheet-codes.ts` (✓/I/S/A/T codes + fills), offline queue sama,
  correction flows, `api/cron/attendance-retention`, semester-rollover.
- Mobile: tidak ada paper import; `Attendance.kt:100` mensummary, bukan memproses sheet.
  `sheet-codes` tidak ada; `SHEET_STATUSES` tidak dicerminkan.
- Dampak: rekap absensi kertas tetap manual.

### 2.4 Admin (platform) & Developer (platform) — pangsa besar belum selesai
- Web: Admin = 14 rute (`applications/[id], assignments/[id], classes/[slug], feedback,
  invitations, reports, users, verifications/[id], overview` dengan moderation panel, metrics,
  activity columns). Developer = 12 rute (`database, incidents, integrations, logs, monitoring,
  security, users, classes, observability`) dengan service-role, Sentry, health panels, migration list.
- Mobile: `AdminConsoleScreens.kt` (1 fungsi `AdminConsoleScreen`) & `DeveloperConsoleScreens.kt`
  (1 fungsi). Data layer ada (`AdminConsole.kt`, `DeveloperConsole.kt`) tapi UI menampilkan
  “counts saja”. Tidak ada: moderation detail, verification decision (hanya list), feedback review
  (`feedback.ts` CRUD), invitation management, class application detail, database details,
  applied migrations, Sentry logs, incident notes, integration status detail.
  `DeveloperConsoleScreen` bahkan didefinisikan 2× (lihat audit sebelumnya).
- Dampak: admin dan developer tetap harus pakai browser untuk alur kerja harian.

### 2.5 Class “academic” admin sub-pages
- Web: `academic/{admins, announcements, attendance, grades, schedule}` + halaman
  `(workspace)/app/classes/[slug]/academic/*` (unlinked-notice, meeting form, roster, correction form,
  paper import, grade batches).
- Mobile: `AcademicAdmin.kt` data ada (list offerings, grade batches, schedule rules, announcements,
  `markAnnouncementRead`), tapi tidak ada UI; `AcademicIdentity.kt` hanya bookmark kartu.
- Dampak: admin kelas yang mengurus akademik tetap di web.

### 2.6 Drive submission + Drive storage & OAuth flows
- Web: `api/assignments/[id]/drive-submit`, `api/assignments/[id]/drive-submissions/[submissionId]/revoke`,
  `lib/db/drive-submissions.ts`, `drive-api.ts/drive-oauth.ts/drive-config.ts` (upload/link dari Drive,
  token crypto, access token server-side), `api/media/[...path]` (signed URL proxy), `api/d/[token]/download`.
- Mobile: hanya model `driveUrl` di `Assignments.kt:79` (ditampilkan, bukan disubmit).
  `Integrations.kt` membuka browser untuk connect, tapi tidak ada drive submit (link/file dari Drive),
  revoke, atau upload langsung dari Drive.
- Dampak: assignment yang wajib submit via Drive tidak bisa dikerjakan di mobile.

### 2.7 Submission review & moderation penuh
- Web: `app/classes/[slug]/review/[id]` (ReviewDecisionForm, ModerationActions, attachment removal,
  status badges), `class-submissions` (listMyClassSubmissions, listClassSubmissions, getSubmissionDetail,
  listAssignmentReviews, getClassDashboardCounts, revise submission), `assignment-trust` (report/revision flow).
- Mobile: hanya `Workspace.reviewWorkspaceRequest()` (approve/reject request) dan
  `reviseSubmission()` + `moderateAssignment()` (unpublish/archive/restore). Tidak ada
  submission list/detail untuk admin, tidak ada attachment moderation, tidak ada review decision form,
  tidak ada assignment reports review.
- Dampak: admin yang menilai submission tetap di web.

### 2.8 Export & reports serius
- Web: `export-jobs/queue/qstash/worker/export`, `export-branding`, `attendance/export-excel`,
  `api/classes/[slug]/attendance/exports/*` (checklist/meeting/recap/report), `api/exports/[id]`,
  `features/export-branding`, `leave/reports` (PDF summary/complete).
- Mobile: hanya `AttendanceExport.kt` (CSV + PDF personal ringan) dan `LeaveForwarding.generateLeaveSummaryPdf/generateLeaveCompletePdf`
  (ada, bagus). Tidak ada export-job service, tidak ada attendance report/recap/checklist,
  tidak ada branding pipeline, tidak ada reports page (`ClassReportsScreen.kt` ada tapi hanya 37 baris delegasi).
- Dampak: kebutuhan admin (export daftar hadir, slip resmi) belum bisa di mobile.

### 2.9 Saved assignments — data ada, UI tipis
- Web: `api/saved-assignments` CRUD + assignment workspace tabs.
- Mobile: `Workspace.kt:680` (`saveAssignment`, `unsaveAssignment`, `loadSavedIds`) + `AssignmentDetailActions.kt`
  memakai — tapi tidak ada halaman “Saved” khusus; saved tak terlihat tanpa membuka detail satu-satu.

### 2.10 DM: daya penuh di desktop; di mobile hanya list-sentuh
- Web DM: `direct-messages.ts` (ciphertext wire format), `dm-v2.ts` (edit/delete/pin/mute/archive/unread/read),
  `api/dm/.../typing`, `api/dm/.../messages/[messageId]/react` (reactions), `XSS`-safe format, block, prefs.
- Mobile: `DmChat.kt` sudah cukup kuat (send/receive, search user, block, prefs, mark read/unread),
  `DmCrypto.kt` E2EE-nya setara. Tapi UI `MessagesScreen` di `MoreScreens.kt` hanya menampilkan
  “🔒 Encrypted” tanpa isi — belum ada: *edit/delete message, reactions, typing indicator, pin, chat detail view*.
- Dampak: mobile hanya bisa lihat daftar peer, tidak bisa memakai DM secara penuh.

### 2.11 Observability & feature flags & beta
- Web: `lib/observability/events.ts` (recordAuthActivity, Sentry env), `integration-status.ts`,
  `external-monitoring.ts`, `lib/auth/beta.ts`, `lib/config/features.ts` (feature flags),
  `lib/cache/redis.ts`, `lib/security/rate-limit.ts/csp.ts/cron-auth.ts`.
- Mobile: hanya `DeveloperConsole.kt` (counts). Tidak ada feature-flag gate, tidak ada Sentry,
  tidak ada cache layer, tidak ada rate-limit client.
- Dampak: observasi prod & flag ramp-up hanya bisa di web.

### 2.12 Courses settings & course availability (course settings page)
- Web: `courses/[courseId]/settings` (course status, availability, enrollments).
- Mobile: `CourseWorkspaceScreen.kt` update course metadata ada, tapi tidak ada availability/enrollment management UI.

### 2.13 Class application & class verification (academic)
- Web: `admin/applications/[id]`, `admin/verifications/[id]` (detail + decision + evidence revoke),
  `api/verification/requests/[id]/*`, `api/classes/applications/*`, `verification/position`,
  `verification/representative`.
- Mobile: hanya data list + decision ringkas (`AdminConsole.kt`); detail application,
  verification evidence, position check, representative grant UI tidak ada.

### 2.14 Onboarding + invite preview + join-by-link
- Web: `onboarding/init-flow.ts`, `api/classes/invitations/preview`, `accept`, `accept-pending`, `decline`,
  `api/classes/join`, `api/classes/lookup`.
- Mobile: `loadInvitations/acceptPendingInvitation/declineInvitation` ada, `joinClassByCode` ada.
  `preview` tidak ada, `accept-pending` flow tidak ada, onboarding UI (`OnboardingScreen`) ada tapi orphan.

### 2.15 Attachments lifecycle penuh (B2/R2/avatars/class-media/leave-evidence/verification-evidence, signed URLs)
- Web: banyak API: `assignments/[id]/attachments*`, `profile/avatar`, `classes/[slug]/media`,
  `branding/logo`, `verification/requests/[id]/evidence*`, `leave-requests/[id]/evidence*`,
  signed-urls, attachment-preview, class-media.
- Mobile: `Attachments.kt` (list/upload/open/delete/rename) + leave evidence path sendiri
  (`LeaveRequestActions`) + avatar upload di `Profile.kt`. Hilang: branding logo upload,
  class media, verification evidence UI, avatar cropping/preview, signed-URL refresh, leave-OCR observe-update.

### 2.16 Notifications grouping & DM notify, push menu penuh
- Web: `lib/notifications/grouping.ts` (grouping + unread count), `dm-notifications.ts` (notifyDmRecipient),
  `api/notifications*`, `api/push/preferences`, `push/subscriptions*`, `event-scheduler`, `reminder-schedule`.
- Mobile: `loadNotifications/markNotificationRead` polos, `NotificationSettings` untuk native FCM
  ada, tapi grouping, DM notify, event scheduler, reminder schedule (24h/3h) hanya sebagian.
  `NotificationsScreen()` di `WorkspaceScreens.kt:125` ultra-sederhana.

### 2.17 Grades publish & CSV
- Web: `grades-publish.ts` (parseGradeCsv, publishGradeBatch), `grades-readonly.ts` (history), 
  course grades API.
- Mobile: `Grades.kt` hanya `listCourseComponentGrades` + `setCourseComponentGrade` per-component.
  Publish batch/CSV/history tidak ada.

### 2.18 Meetings (web `sessions`) → mobile belum jadi
- Web: `sessions/new`, `sessions/[id]`, `sessions/[id]/edit`, `checkin-location`, `rsvp`, `status`,
  `calendar-sync`, `checkins` list/delete.
- Mobile: `SessionEdit.kt` (`rsvpSession`, `cancelRsvp`, `setCheckInLocation`, `updateSessionRecord`),
  `CreateActions.kt createSession` ada, tapi UI `NewSessionScreen`/`NewClassSessionScreen` orphan,
  `SessionDetailScreen` (DetailScreens, versi lama), `AttendanceSessionDetailScreen` yang bagus tapi tak terjangkau,
  calendar-sync tidak ada.

### 2.19 Class schedule CRUD (jadwal kelas admin)
- Web: `class-schedule.ts` (list/create/update/delete, batch, import), `api/classes/[slug]/schedule*`.
- Mobile: `AcademicAdmin.listScheduleRules` (read-only) + `SchedulesAndLeave.loadSchedule` (read daftar schedule siswa).
  Create/update/delete/batch/import = tidak ada.

---

## 3. MIN — sebagian / drift

| # | Fitur | Web | Mobile | Gap |
|---|---|---|---|---|
| 3.1 | Class materials | `course-materials.ts` CRUD + API materials | `ClassCourses.kt` list + create + update; tidak ada delete UX khusus | delete path tidak dipanggil UI |
| 3.2 | Class metadata / admins | `class-actions`, `class-admins-service`, `class-management-service` | `ClassManage.kt` delete, join policy, status, assign/revoke admin | `assignClassAdmin` RPC guard client-side saja |
| 3.3 | Announcements | `announcements.ts` CRUD + read tracking | `AcademicAdmin.listAnnouncements/markAnnouncementRead` + `ManageAndReports.publishAnnouncement` | tidak ada update/delete announcement UI |
| 3.4 | Course offerings + enrollment | `course-offerings`, `course-enrollments`, `countActiveEnrollments`, `listMyEnrollments`, `getMyHomeMembership` | list offerings ada, enrollments tidak | admin tak bisa kelola roster |
| 3.5 | Integrations (calendar/drive status) | `google-calendar-service`, oauth-state, drive-oauth | `Integrations.kt` buka browser + status read | disconnect tidak ada; scope & token refresh server-only |
| 3.6 | Calendar events | `calendar-events.ts` CRUD + `class-calendar.ts` feed | `CalendarEvents.kt` CRUD lengkap; class feed = 1 fungsi arsip saja | tidak ada feed aggregated |
| 3.7 | Action Center compliance | checklist untuk tracked | ✓ implementasi | duplikat tab tidak sinkron |
| 3.8 | Assignment filters / sorting | `course-assignment-filters`, cursor pagination (`cursor.ts`) | `AssignmentLogic.kt` grouping/sorting lokal; tidak ada cursor pagination | list besar akan berat |
| 3.9 | Feedback | `feedback.ts` + admin review | `AccountFeedback.kt` + `SettingsFeedback.kt` (kirim → server tidak ada STEM?) | verifikasi pengiriman tidak jelas; cek |
| 3.10 | Class applications (student apply) | `class-application-service`, `class-invitation-service` | `submitApplication` ada | status tracking tipis |
| 3.11 | Academic identity card | `AcademicContextCard`, `unit-tree`, `ProfileAcademic` | `AcademicIdentity.loadAcademicCard` | UI kartu di `UniversityScreen` saja |
| 3.12 | Assignments attachments MIME | upload-limit server (`upload-limit.ts`) | `AssignmentsDialogs` filter picker MIME client | validasi size/type client saja |

---

## 4. Sudah parity (jujur, jadi referensi)

- **Auth & session:** Supabase session decode + RLS diturunkan ke server. Gap-nya hanya native-login wiring.
- **Leave Requests:** backend paling lengkap. `leave.ts` ↔ `LeaveRequests.kt` + `LeaveRequestActions.kt`
  + `LeaveForwarding.kt`. Status & validasi (1–365 hari, 10–4000 chars, evidence magic-bytes) persis.
- **Schedule/Calendar data:** `Calendar.kt` ↔ `calendar.ts`; `CalendarDates.kt` ↔ `packages/shared/calendar.ts`.
- **Assignments workspace data:** `Workspace.kt` ↔ `assignment-workspace.ts` — `getWorkspaceScope` sama persis.
- **Attendance check-in:** GPS (CheckInPosition), offline queue, `CheckIn.kt` RPC — setara web. Yang hilang hanya UX admin (paper OCR).
- **DM E2EE:** `DmCrypto.kt`/`DmKeys.kt` ↔ `crypto/e2ee.ts`/`key-backup.ts`; PBKDF2 600k + AES-GCM setara web (kompatibel 100k legacy).
- **Grades component:** `Grades.kt` ↔ `course-grades.ts` (read/write per-component).
- **Admin/Developer data murni:** tabel & RPC sama, hanya UI-nya yang belum jauh.

---

## 5. Yang *tidak* perlu diport (server-only)

| Web-only | Alasan mobile tidak butuh |
|---|---|
| `api/cron/*` (attendance-retention, deadline-reminders, push-dispatch, session-jobs, unpam-sync, notification-events/retention, log-retention) | server jobs |
| `lib/observability/events.ts` write path, `sentry-env`, `redis`, `qstash`, `export-runner`, `cron-auth` | server infra |
| `lib/security/csp.ts`, `rate-limit.ts` server, `service-role.ts`, `supabase/admin.ts` | client tidak boleh pegang service role |
| `lib/db/fetch-all.ts`, `cursor.ts` server helpers | helper paging web saja |
| `lib/integrations/google/*token-crypto` | token storage server-side; mobile hanya buka Custom Tab (Integrations.kt sudah benar) |
| `lib/geo/google-maps.ts`, `api/geo/resolve-maps-link` | tidak perlu peta web; IGPS lokal cukup |
| B2/R2 direct upload (`lib/storage/b2.ts/r2.ts`) | client pakai Supabase storage saja |
| `api/worker/export` | server export runner |
| `lib/share/whatsapp.ts` | native intent di `AssignmentDetailHeader` sudah cukup |

---

## 6. Daftar file-per-file: yang *harus* ditulis vs disambungkan

**Harus ditulis baru (Tidak ada di mobile sama sekali):**
- Public landing & marketing (`landing/*`, `(site)/*`, `d/[token]`)
- Onboarding flow penuh + invite preview + class lookup
- Schedule import (OCR + AI-vision) + weekly board drag + overflow dialog
- Attendance paper import + sheet codes + retention UI
- Admin platform UI penuh (applications/verifications detail, reports, feedback, invitations, users, assignments)
- Developer platform UI (database details, migrations, incidents notes, logs, monitoring, security, Sentry)
- Academic admin UI (`academic/*` 5 sub-pages)
- Drive submission (link/upload/revoke) + Drive status disconnect + class media/branding logo
- Submission review penuh (submission detail, moderation, assignment reports, dashboard counts)
- Export jobs + branding pipeline + attendance report/recap/checklist exports + grades publish CSV
- Course settings + course availability + roster
- DM penuh di mobile (edit/delete/react/typing/pin/archive/unread)
- Notification grouping + DM notify + reminder schedule
- Grades batch publish + history
- Sessions edit + calendar-sync + checkins management
- Class schedule CRUD + batch + import
- Observability panels (feature flags, integration status)

**Sudah ditulis, hanya perlu disambungkan (orphan):**
`ActionCenterScreen, ProfileScreen, SecurityPrivacyScreen, FeedbackScreen, NotificationSettingsScreen,
SettingsHubScreen, LeaveRequestsScreen + detail/form, ScheduleScreenNew, AssignmentsWorkspaceScreen
(+attachments/saved), GradesScreen, ClassManageScreen, ClassReportsScreen, AttendanceSessionDetailScreen,
CourseWorkspaceScreen, CourseDetailScreen, UniversityInfoScreen, PluginsScreen, AdminConsoleScreen,
DeveloperConsoleScreen, ClassJoinScreen, InvitationsSection, OnboardingScreen, SubmitAssignmentScreen,
NewSessionScreen, SubmissionReviseScreen, ApplicationsScreen`

**Harus dihapus/dirapikan (duplikasi):**
`WorkspaceScreens.kt` (old), `MoreScreens.kt` old (`MessagesScreen` + `SettingsScreen` trivial),
`DetailScreens.kt` (old `ClassDetailScreen/SessionDetailScreen/LeaveRequestFormScreen`),
`ScheduleLeaveScreens.kt` old schedule, `SettingsConsoleScreens.kt` (lokal),
`Home*` 12 file pecahan berlebihan, `DevBypass*`, `GoogleAccountChooser.kt`, duplikat `DeveloperConsoleScreen`,
duplikat `ClassDetailScreen`, duplikat `LeaveRequestFormScreen`, duplikat `ScheduleScreen`.

---

## 7. Estimasi kasar

| Kategori | Jumlah file/fitur | Effort kasar |
|---|---|---|
| A. Sambungkan orphan jadi reachable | ~30 screen — wiring NavHost | 3–5 hari |
| B. Hapus duplikat + tekankan file >600 | ~8 file hapus, 12 file pecah | 2–3 hari |
| C. Public surface + onboarding + invite | ~6 halaman | 2 hari |
| D. Schedule import + paper OCR | server parser ada → mobile client saja | 3–5 hari |
| E. Admin platform UI + Developer UI | ~14 rute admin + 12 developer | 5–8 hari |
| F. Academic admin 5 sub-pages | ~5 halaman + roster/metings CRUD | 3–5 hari |
| G. Drive submit + saved assignments page | ~3 halaman | 2 hari |
| H. Submission review + moderation | ~2 halaman + reports | 3 hari |
| I. Exports + branding pipeline | server queue + mobile trigger | 3 hari |
| J. DM penuh + notifications grouping | ~3 halaman | 3 hari |
| K. Courses settings + academics lifecycle | ~4 halaman | 2 hari |

Satu catatan terakhir: **ini belum termasuk mobile web-sync terhadap perubahan kontrak** (`packages/contracts/*`).
Jika contracts berubah, parity mobile akan drift tanpa regenerasi. Pertimbangkan test kontrak bersama
seperti `ProfileLogicTest.kt` untuk field kritis (leave/attendance/calendar).

---

*Audit disusun mengikuti Requirement → Evidence → Gap → Severity; path relatif ke repo root.*
