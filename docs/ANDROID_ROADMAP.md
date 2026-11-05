# Android Roadmap — StarsTask Mobile

Peta jalan membangun aplikasi Android StarsTask sampai rilis Play Store.
Setiap item memakai format checklist: centang `[x]` kalau sudah selesai
dan terverifikasi, biarkan `[ ]` kalau belum.

Keputusan arsitektur yang sudah diambil:

- Capacitor sebagai cangkang native, bukan rewrite React Native/Expo.
- Web app (`apps/web`) tetap satu-satunya sumber UI; mobile tidak fork kode.
- Build web untuk mobile memakai Vite di `apps/mobile` (`webDir: dist`).
- Push memakai plugin Capacitor (`@capacitor/push-notifications`, FCM).
- Ikon & splash memakai aset yang sama dengan PWA (`apps/web/public/icons`).

## Fase 0 — Scaffolding (selesai)

- [x] `apps/mobile` dibuat: Capacitor 6 + Vite + TypeScript
- [x] `@capacitor/android` ditambahkan sebagai dependency
- [x] Proyek native `android/` di-generate (`npx cap add android`)
- [x] `vite build` mobile lolos
- [x] APK debug berhasil dibuat (`gradlew assembleDebug`)
- [x] Runbook Android di `apps/mobile/README.md`

## Fase 1 — Keputusan fondasi

- [ ] Putuskan mode WebView: bundel hasil `vite build` lokal, atau load
      server produksi (`starstask.vercel.app`) via `server.url` - Rekomendasi: bundel lokal untuk offline-first check-in; server URL
      hanya sebagai fallback saat pertama launch
- [ ] Putuskan alur login di WebView: Supabase Auth Google di dalam WebView
      vs Custom Tab browser terpisah, termasuk deep link callback
      (`id.starstask.mobile://` atau App Links `https://starstask.app`)
- [ ] Samakan identitas aplikasi: appId `id.starstask.mobile`, nama
      "StarsTask", ikon 192/512 + maskable dari `apps/web/public/icons`
- [ ] Tentukan strategi update: update lewat Play Store vs OTA di dalam
      WebView (web app memang selalu segar, jadi OTA cukup untuk konten)

## Fase 2 — Paritas fitur inti

- [ ] Dashboard ringan: jadwal hari ini, tugas terdekat, status absensi
- [ ] Check-in absensi memakai GPS native (`@capacitor/geolocation`)
      dengan radius check-in yang sama seperti web
- [ ] Antrean offline check-in dipindah dari `apps/web/src/lib/attendance/offline-queue.ts`
      ke mobile, tersinkron saat online lagi
- [ ] Upload lampiran tugas dari penyimpanan/perangkat (izin storage & kamera)
- [ ] Buka PDF / dokumen lampiran di luar WebView bila perlu

## Fase 3 — Push notification native (FCM)

- [ ] Buat Firebase project, unduh `google-services.json` ke `android/app/`
- [ ] Daftarkan token FCM ke server (gantikan/tambah Web Push yang ada)
- [ ] Notification channel Android: reminder deadline 24 jam & 3 jam,
      pengingat sesi, publikasi tugas baru
- [ ] Tap notifikasi membuka halaman yang benar (deep link)
- [ ] Uji di device fisik: foreground, background, dan aplikasi ditutup

## Fase 4 — Release Android

- [ ] Ikon & splash final (semua densitas), nama aplikasi, warna tema
- [ ] `versionCode` / `versionName` dikelola per rilis
- [ ] Signing key release dibuat & disimpan aman di luar repo
- [ ] Build AAB release (`gradlew bundleRelease`) lolos tanpa warning
- [ ] Uji regresi di minimal 2 ukuran layar + Android versi lama & baru
- [ ] Periksa ukuran APK/AAB dan waktu cold start

## Fase 5 — Terbit di Play Store

- [ ] Data safety form: data apa yang dikumpulkan & tujuannya (lokasi GPS
      untuk check-in, token push, dokumen tugas)
- [ ] Privacy policy URL publik
- [ ] Listing: ikon, screenshot, deskripsi ID/EN, kategori, rating konten
- [ ] Closed testing ke grup internal dulu, kumpulkan masukan
- [ ] Production release setelah closed testing bersih
- [ ] Catat nomor build yang terbit + tanggal rilis di dokumen ini

## Fase 6 — Otomatisasi CI

- [ ] GitHub Actions: build web mobile + `cap sync` + `assembleDebug`
      di setiap push ke branch mobile
- [ ] Build AAB otomatis saat tag rilis, artifact di-upload ke Actions
- [ ] (Opsional) upload AAB ke Play Internal Testing via API service account

## Kriteria selesai keseluruhan

- [ ] Check-in GPS absensi jalan dari aplikasi Android, bukan hanya browser
- [ ] Push reminder sampai di device yang ditutup aplikasinya
- [ ] App bisa di-install dari Play Store (atau sideload APK untuk pilot)
- [ ] Pengalaman pengguna lama tidak berubah: satu akun, satu data, web & mobile
      membaca Supabase yang sama
