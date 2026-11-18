# BOARD

**GOAL:** Memisahkan scope & navigasi role Lecturer dari student UI, membuat halaman terkait (`/attendance`, `/leave-requests`, `/schedule`) role-aware, mengimplementasikan validasi inti manajemen perkuliahan (schedule collision, BAP & tracker tatap muka, bobot/rentang nilai + aturan 75% kehadiran, auto-cutoff presensi), serta mendokumentasikannya di `docs/`.

**DONE MEANS:**
- Navigasi lecturer (`workspace-nav-items.ts`, `workspace-nav.tsx`, `mobile-tab-bar.tsx`) menampilkan menu khusus pengajar (`Teaching home`, `Action center`, `Classes`, `Schedule`, `Attendance`, `Absence requests`, plus `Campus` jika aktif) tanpa section `"My studies"` default (escape hatch `/app?view=student` tetap ada), dan unit test navigasi lulus.
- Halaman `/attendance`, `/leave-requests`, dan `/schedule` bersifat role-aware: saat diakses lecturer, menampilkan view pengajar (rekap/kelola presensi kelas, review izin mahasiswa, jadwal mengajar) bukan form check-in/submit mahasiswa.
- Validasi perkuliahan berjalan di layer Zod (`@starstask/contracts`), DB/RPC (`supabase/migrations/`), dan UI:
  - Time-slot collision check (`start_time < existing_end AND end_time > existing_start`) pada `class_course_schedules`.
  - Catatan topik BAP sebelum tutup sesi & tracker jumlah tatap muka (target 14–16x) di `attendance_meetings` + `/lecturer`.
  - Validasi bobot komponen nilai (total `= 100%`), rentang nilai `0–100`, dan indikator kelayakan kehadiran `< 75%`.
  - Auto-cutoff presensi (lewat batas waktu otomatis `absent` kecuali memiliki izin terverifikasi).
- Dokumentasi lengkap tersimpan di `docs/LECTURER_ROLE_AND_VALIDATION.md` (cakupan role, arsitektur validasi, dan batasan terhadap SIAKAD/KRS).
- Semua file berubah lolos ESLint (0 error, 0 warning), Prettier, TypeScript `typecheck`, dan unit/integration tests terkait.

**LIMITS:** max 4 concurrent workers, max 2 fix rounds per task, checker selalu worker baru yang berbeda dari author.

---

## RULES FOR EVERYONE

- Format: Ikuti `AGENTS.md` (Prettier, ESLint zero-warning, max 300 lines per file baru/ubah, TypeScript strict tanpa `any`).
- Style: UI mengikuti design system StarsTask yang ada (no emoji in UI code, Apple-clean aesthetic, Tailwind tokens). Bahasa: English untuk kode/komentar/UI labels yang konsisten dengan app, Indonesia untuk docs jika diminta atau bilingual teknis.
- Good sources: `AGENTS.md`, `apps/web/src/components/lecturer/*`, `apps/web/src/lib/db/*`, `packages/contracts/src/*`, `supabase/migrations/*`.
- Out of scope: Pengganti penuh SIAKAD/KRS kampus (SKS/IPS prasyarat) & isolated Docker/Judge0 code-execution sandbox (didokumentasikan sebagai fase lanjutan di `docs/`).

---

## DECISIONS

| decision | reason | by |
| :--- | :--- | :--- |
| Pisahkan `TEACHING_ITEMS` tanpa `"My studies"` default; `/app?view=student` tetap tersedia | Menghindari UI mahasiswa muncul di akun dosen | coordinator |
| Implementasi validasi pakai stack repo (Zod + Supabase Postgres RPC/Constraints/Cron) | Konsisten dengan arsitektur StarsTask tanpa tambah infra eksternal | coordinator |

---

## TASKS

| ID | Owner | Status | Fix rounds | Note |
| :--- | :--- | :--- | :--- | :--- |
| T1 | worker-T1 | open | 0 | Navigasi & role-aware pages (`/attendance`, `/leave-requests`, `/schedule`) |
| T2 | worker-T2 | open | 0 | Schedule collision & BAP/meeting count tracker (DB + contracts + UI) |
| T3 | worker-T3 | open | 0 | Attendance auto-cutoff, 75% rule, & grading weight/range validation |
| T4 | worker-T4 | open | 0 | Dokumentasi arsitektur & panduan di `docs/LECTURER_ROLE_AND_VALIDATION.md` |

Status: `open` → `done` → `pass` or `fail`
