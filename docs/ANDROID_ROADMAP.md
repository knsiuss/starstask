# Android Roadmap — StarsTask Mobile

Peta jalan membangun aplikasi Android StarsTask sampai rilis Play Store.
Setiap item memakai format checklist: centang `[x]` kalau sudah selesai
dan terverifikasi, biarkan `[ ]` kalau belum.

Keputusan arsitektur yang sudah diambil:

- Capacitor sebagai cangkang native, bukan rewrite React Native/Expo.
- Web app (`apps/web`) tetap satu-satunya sumber UI; mobile tidak fork kode.
- Build web untuk mobile memakai Vite di `apps/mobile` (`webDir: dist`).
- Push memakai plugin Capacitor (`@capacitor/push-notifications`, FCM).
- Ikon & splash native di-generate dari satu master 1024x1024 memakai
  `@capacitor/assets` (ikon PWA 192/512 bukan ikon store native).

## Fase 0 — Scaffolding (selesai)

- [x] `apps/mobile` dibuat: Capacitor 6 + Vite + TypeScript
- [x] `@capacitor/android` ditambahkan sebagai dependency
- [x] Proyek native `android/` di-generate (`npx cap add android`)
- [x] `vite build` mobile lolos
- [x] APK debug berhasil dibuat (`gradlew assembleDebug`)
- [x] Runbook Android di `apps/mobile/README.md`

## Fase 1 — Keputusan fondasi

- [x] Mode WebView: **bundel lokal** (`webDir: dist`) sebagai jalur utama.
      Alasan: launch instan, check-in offline jalan tanpa jaringan, dan
      terasa seperti app native. `server.url` hanya untuk development
      (live reload) — bukan jalur produksi, karena koneksi jelek berarti
      layar kosong dan app yang isinya cuma website berisiko ditolak Apple
      (guideline fungsi minimum). Fallback server saat first launch boleh.
- [x] Alur login: **wajib keluar WebView**. Google memblokir OAuth di
      dalam WebView (`disallowed_useragent`), jadi alurnya: tombol login
      di app → Custom Tab / browser sistem (plugin `@capacitor/browser`) →
      user login di sana → callback balik via deep link → app menukar code
      jadi session dengan pola PKCE (pola resmi Supabase untuk Capacitor).
      Deep link tahap awal memakai custom scheme `id.starstask.mobile://`
      (cepat jalan); sebelum rilis publik pindah ke App Links terverifikasi
      (`https://starstask.app`) karena custom scheme bisa diklaim app lain.
- [x] Identitas aplikasi: appId `id.starstask.mobile`, nama "StarsTask".
      AppId Android permanen begitu publish di Play Store — sudah benar
      sejak awal. Ikon native (iOS AppIcon 1024, Android adaptive icon
      foreground + background terpisah) di-generate dari satu master
      1024x1024 (art dari `apps/web/public/icons`) memakai `@capacitor/assets`.
- [x] Strategi update berlapis: shell native (plugin, permission, upgrade
      Capacitor) lewat Play Store; isi web (UI, logika JS) lewat OTA
      Capgo (`@capgo/capacitor-updater`) tanpa menunggu review store —
      legal selama tidak mengubah fungsi utama app. Web Next.js di Vercel
      memang selalu segar untuk user browser; permukaan yang bisa basi
      hanya bundel mobile, dan itu yang ditutup Capgo.

## Fase 2 — Paritas fitur inti

- [x] Dashboard ringan: jadwal hari ini, tugas terdekat, status absensi
- [x] Check-in absensi memakai GPS native (`@capacitor/geolocation`)
      dengan radius check-in yang sama seperti web
- [x] Antrean offline check-in (`lib/offline-queue.ts`): posisi tersimpan
      lokal saat gagal kirim, tersinkron otomatis saat `online` kembali
- [x] Upload lampiran tugas dari perangkat (file picker WebView →
      `assignment-attachments` + record `assignment_attachments`)
- [x] Buka PDF / dokumen lampiran di luar WebView (signed URL dibuka
      lewat Custom Tab)

## Fase 3 — Push notification native (FCM)

- [ ] Buat Firebase project, unduh `google-services.json` ke `android/app/`
- [ ] Daftarkan token FCM ke server (gantikan/tambah Web Push yang ada)
- [ ] Notification channel Android: reminder deadline 24 jam & 3 jam,
      pengingat sesi, publikasi tugas baru
- [ ] Tap notifikasi membuka halaman yang benar (deep link)
- [ ] Uji di device fisik: foreground, background, dan aplikasi ditutup

## Fase 4 — Release Android

- [ ] Ikon & splash final: generate semua ukuran native dari master
      1024x1024 memakai `@capacitor/assets`, nama aplikasi, warna tema
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
