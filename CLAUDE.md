# CLAUDE.md — Multi-Agent Coordination (StarsTask)

File ini mengatur **bagaimana beberapa agent bekerja bersamaan** di repo ini.
Aturan engineering (lint, style, security, dll.) tetap ada di `AGENTS.md` dan **tidak diulang di sini** — baca itu juga.
File ini melengkapi, bukan menggantikan, `AGENTS.md`.

Repo ini sedang dikerjakan oleh banyak agent paralel (setiap agent bisa tidak melihat pekerjaan agent lain). Tanpa aturan koordinasi, agent bisa saling menimpa, drop stash milik agent lain, atau "memperbaiki" file yang sedang aktif ditulis orang lain.

---

## 1. Sebelum mulai apa pun

1. Baca `AGENTS.md` di root repo ini. Ini wajib, bukan opsional.
2. Cek `git status --porcelain` **sebelum** edit. Kalau file yang akan kamu sentuh tampak sudah diubah agent lain (atau ada untracked baru di area itu), jangan langsung edit — lihat dulu.
3. Jangan edit di atas pekerjaan agent lain. Kalau file berubah mendadak di luar perintahmu di tengah sesi (disebutkan di system-reminder / muncul di `git status`), anggap itu pekerjaan agent lain: baca ulang, **jangan revert, jangan stash, jangan overwrite**. Sesuaikan rencanamu.
4. Satu file = satu owner pada satu waktu. Kalau tidak yakin file itu milik siapa, tanyakan owner/user dulu daripada nebak.

## 2. Git — larangan keras (lesson dari insiden nyata)

- **JANGAN** `git stash drop`, `git stash pop`, `git checkout -- <file>`, `git restore`, `git reset --hard`, `git clean -f` pada file yang bukan kamu yang buat.
- **JANGAN** menambah/menghapus ref (`git tag`, `git branch -D`, `git push`) tanpa instruksi eksplisit. Kalau harus menandai dangling commit untuk keamanan, **tanyakan dulu**.
- Kalau `git stash pop` gagal, **berhenti** — jangan drop apa pun untuk "membersihkan". Laporkan ke user.
- Stash adalah data orang lain. Anggap setiap stash bukan milikmu sampai terbukti.
- **JANGAN commit** tanpa diminta. Kalau diminta commit: `git add <file spesifik>`, bukan `git add -A`, dan cek dulu tidak ada rahasia/personal data di diff.
- Branch kerja: jangan pindah branch, jangan force-push, jangan merge tanpa instruksi.

## 3. Konflik nama antar-agent (contoh nyata yang sudah terjadi)

Agent redesign pastel menulis `DashRadiusCard`, konsumennya memanggil `DashRadiusCardShape` → 22 error. Ini contoh gesekan nama antar-agent.

- Kalau semua konsukar memanggil nama X dan definisi cuma bernama Y, perbaiki di **salah satu sisi** saja, dan koordinasikan bila file itu milik agent lain — jangan tambal asal.
- Jangan membuat "alias ganda" tanpa sadar; kalau kamu menemukan ketidakcocokan nama lintas-file milik agent lain, **laporkan dulu**, baru fix jika user bilang lanjut.
- Kelola area token/tema bersama lewat satu agent pembicaraan, bukan saling edit.

## 4. Build & verifikasi

- Sebelum edit: jalankan baseline (mis. `gradlew :app:assembleDebug --offline`), catat error pre-existing. Setelah edit: bandingkan — **tidak boleh menambah error baru**.
- **Nol error dari file yang kamu ubah** adalah standar; error di file agent lain yang sedang aktif ditulis bukan tanggung jawabmu untuk ditambal diam-diam.
- APK belum bisa dijalankan via adb sampai build sukses. Jangan klaim "terlihat di HP" kalau belum benar-benar jalan.
- Web (`apps/web`) dan native mobile (`apps/mobile/android`) adalah permukaan yang berbeda — jangan sentuh web kalau task native, dan sebaliknya.

## 5. Saat ada banyak agent paralel

- **Owner-first**: kalau user menyebut ada beberapa agent, sebelum edit file di luar area yang jelas "milik" kamu, pastikan dulu dengan user/owner.
- Kalau file berubah di luar kamu di tengah sesi → baca ulang, jangan revert. Reconcile dengan pekerjaanmu, atau tinggalkan file itu dan fokus ke area yang tidak bentrok.
- Jangan "membersihkan" atau merapikan file milik agent lain (menghapus dead code di sana, memindahkan paket, dll.) kecuali diminta eksplisit.
- Kirim progres dengan jujur: "build masih gagal karena X di file Y (file agent lain), nol error dari perubahan saya."

## 6. Laporan jujur ke user

- Jangan klaim build/test/lint sukses kalau belum dijalankan. Bedakan "gagal" vs "tidak bisa dijalankan (offline/dependency)".
- Laporkan kerusakan yang kamu sendiri sebabkan (mis. stash ter-drop) — jangan sembunyikan. Sertakan cara pulihkan (mis. commit hash dangling / tag backup).
- Sertakan perintah pemulihan persis yang bisa langsung dijalankan user.

---

Kalau `CLAUDE.md` ini dan `AGENTS.md` bertentangan: `AGENTS.md` menang untuk aturan engineering; file ini menang untuk koordinasi multi-agent.
