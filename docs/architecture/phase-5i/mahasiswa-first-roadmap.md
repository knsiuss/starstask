# StarsTask — Product Roadmap (Mahasiswa-First, Campus-Verified)

**Posisi:** Bukan “software yang dijual ke kampus”, tapi layanan untuk mahasiswa yang cukup terverifikasi untuk membuka porsi komunitas kampus ekosistem.

## 1. Positioning

Mis: **StarsTask is a verified academic social platform for campuses: attendance, campus community, and alumni discovery in one place.**

Elemen penting:

- Wajibkan akun mahasiswa dengan verifikasi identity kampus (kelas yang sudah terisi).
- Membership multi-campus opsional, tetap terpisah.
- Social feed = per kampus, bukan global noise.
- Admin kelas masih bisa punya pengumuman resmi.
- Launch pertama: 1 kampus, attend/verified onboarding masuk dulu.

## 2. User Fase Awal

- Mahasiswa satu prodi/fakultas dulu.
- Operator: 1–2 class admin + 1 fakultas sponsor promosi.
- Goal: 100–300 mahasiswa aktif, retention 2 minggu.
- Setiap invite berasal dari akun mahasiswa terisi.

## 3. Pilar Produk

### 3.1 Attendance keperlu an per kelas

- attendance session, meeting, roster
- settled lifecycle dan audit (`record_audit`)
- tidak memindahkan DB lama sebelum audit selesai

### 3.2 Community allowance

- per kampus:
  - study group
  - sharing resources
  - event kampus
  - info kelas
  - announcements resmi

Fitur social yang wajib keamanan:

- moderation queue per kampus
- block/report
- content tak-berlisensi handling
- rate limit
- listing agresif pub vs private

### 3.3 Profile / Verified Identity

- kampus verified badge
- status alumni pemisah dari mahasiswa aktif
- multi-campus opsional
- privacy default: tidak publikkan NIM / email / location

## 4. Fitur Masuk Fase Iterasi Dua

| Fitur        | Kategori           | Konten                   | Scope                  |
| ------------ | ------------------ | ------------------------ | ---------------------- |
| Directory    | Campus communities | orang & kelas verified   | opt-in daftar kampus   |
| Social feed  | Per kampus         | first feed terverifikasi | opt-in                 |
| Study groups | Academic           | grup study               | controlled invitations |
| Career board | Campus/career      | lowongan, internship     | verified postings only |
| Event        | Campus             | career fair, etc.        | verified org           |
| Marketplace  | Campus             | tutoring/career service  | kecil & terbatas       |

## 5. Open Target KPIs

Fase Awal:

- 100–300 active users
- retención 2 minggua ≥ 30%
- 1 salah satu mahasiswa aktif/kelas aktif

## 6. Monetisasi (tidak ditentukan final)

- Freemium premiumverified badge
- Sponsored events
- Career partnership
- Marketplace commission
- Enterprise add-on untuk kampus bila perlu (tapi tujuan utama mahasiswa)

## 7. Risk & Compliance

- Moderation staffing cost
  -隐私 leakage (NIM, location, email)
- harassment/bullying
- promosi kampus & brand safety
- traffic spike setelah launch viral

## 8. Decision Gates (jangan implement sebelum ini)

1. Apakah social feed per kampus atau lintas kampus? **Tidak diputuskan.**
2. Apakah moderation role per kampus ada? **Tidak ada desain.**
3. Apakah verifikasi alumni otomatis atau manual? **Tidak diputuskan.**
4. Apakah storage UGC fee dimoderasi? **Tidak diudit.**

## 9. Roadmap Setelah MVP

Fase MVP (sekarang):

- identity + classes + attendance
- class announcements

Fase 2:

- per-kampus directory + verified profile
- mini social feed & study groups

Fase 3:

- event + career board
- alumni discovery

Fase 4:

- marketplace & premium
- marketplace alumni/tutoring
- enterprise expansion untuk universitas

## 10. Non-Goals

- Bukan aplikasi design untuk “jual ke universitas”
- Bukan otomatis migrated data legacy bukan milik mahasiswa
- Bukan dibangun sebagai LMS full-suite di tahap awal
- Bukan face-recognition atau lokasi untuk absensi tanpa consent

Semua yang tidak tercantum di atas merupakan hipotesis. Begitu ada data usage, revisit.

**Status: roadmap awal, bukan janji produk final.**
