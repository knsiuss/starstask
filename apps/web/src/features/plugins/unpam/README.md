# UNPAM / FTI plugin — hasil riset live (2026-11-04)

Sumber: `https://ftiunpam.com/` via Chrome DevTools. Semua info di
bawah ini publik & tanpa login. Tidak ada kredensial di dokumen ini.

## Status per sumber

| Sumber                             | Status                             | Target                           |
| ---------------------------------- | ---------------------------------- | -------------------------------- |
| Kalender Akademik (`/kalender`)    | ✅ Auto-scrape siap                | `class_calendar_events`          |
| Jadwal MENTARI info (`/elearning`) | ✅ Auto-scrape siap                | `class_calendar_events` / jadwal |
| Pengumuman (`/pengumuman`)         | ⚠️ Semi-manual (teks unstructured) | `class_calendar_events`          |
| LMS MENTARI (isi mata kuliah)      | ❌ Tak tersentuh                   | manual / jalur resmi             |

## Kalender (`/kalender`)

Tabel: `# | Tanggal Awal | Tanggal Akhir | Kegiatan | Penugasan`.
Filter semester `2019/2020 Gasal` → `2026/2027 Gasal`. Contoh kegiatan:
"Online Learning mahasiswa Reguler A & B [1 SKS - Pertemuan 2]",
"Pelaksanaan UTS susulan", "Akhir penginputan nilai UTS".

## Jadwal MENTARI info (`/elearning`)

Judul: "JADWAL MANAJEMEN TERPADU PEMBELAJARAN DARING (MENTARI)".
Periode daring Reguler A & B `02-11-2026 s/d 06-11-2026`, Reguler C
`02-11-2026 s/d 07-11-2026` (Kelompok MK 1). Plus daftar dokumen
(Surat Edaran, Keputusan Rektor, dll). Halaman ini info publik,
bukan LMS-nya — jadi aman diambil tanpa login.

## Pengumuman (`/pengumuman`)

Contoh: Seminar Nasional TI "Preparing Future Talent for the AI Era",
`25 Nov 2026`, pendaftaran online s/d `11 Nov 2026`. Teks bebas,
jadi ambil judul + tanggal + link saja, detail tetap manual.
