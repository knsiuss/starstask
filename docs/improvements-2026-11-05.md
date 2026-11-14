# Improvement Notes — 2026-11-05

Bagian yang udah dikerjain hari ini, diringkas buat md.

## Attendance

- Auto-open: create dengan lokasi + waktu lewat = langsung open (trigger DB)
- Pertemuan 9 dibuka manual, check-in langsung bisa
- Backfill legacy checkins (337) -> attendance_records (329) + attendance_meetings (20)
- Gate join date: jangan dihapus, tampilkan not_applicable (bukan absent)
- Offline check-in queue (localStorage + tabel server, sync saat online)
- UX create: hint lokasi terisi + waktu lewat = auto-open

## Export

- Recap filename: tahun kalender sekarang (2026), bukan end year academic year
- Allowed types: + CSV, IPYNB, TXT, MD, JSON, PY, JS, TS, HTML, CSS, ZIP, MP4, MP3
- File invalid -> assignment jadi draft, bukan gagal total
- Excel: CSV compatible download (`export-excel.ts`)

## Notifications

- Assignment baru -> in-app + Web Push (Chrome) ke class members kecuali author
- Trigger DB + dispatch after response
- Grouping per hari: view notification_daily_digest

## Semester

- Helper nextAcademicYear / isNewSemesterNeeded
- View semester_rollover_candidates buat deteksi tahun ajaran baru

## Plugin UNPAM

- Gate registry (membership, bukan teks bebas)
- Events persisted ke DB + cron sync 05:00
- Auto program dari academic_units
- Dashboard widget + settings sync status

## DM E2EE (feat/dm-e2ee only, bukan main)

- ECDH P-256 + AES-GCM, private key IndexedDB, server ciphertext only
- Media terenkripsi (image/video/files, 25MB)
- Realtime, typing, online, seen, swipe, emoji, story, theme, call, search, backup, draft
- Jangan merge ke main tanpa review

## Perf

- Parallelize layout/dashboard, cache per-request
- Suspense streaming per-section dashboard
- RPC overview: 8+ query -> 1 roundtrip, TTFB warm ~0.5s

## NIM

- Prefixed per-university: UNPAM-..., BRAWIJAYA-...
- Dual-write profiles.nim -> student_identities

## Audit

- Backfill 256/291 via class/membership, 35 NULL historis dibiarkan
- Trigger autofill buat row baru, CHECK NOT VALID future rows

## Dual-write

- class_members -> class_memberships trigger mirror
- is_class_member: legacy OR baru (cutover gradual)

## Free tier only

- No paid Supabase branch, local stack buat staging
