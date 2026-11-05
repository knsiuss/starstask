# StarsTask — Production-Scale Hardening Plan

Kondisi terhadap sebelumnya: foundation multi-tenant foundation live; UI/flow menyusul. Tujuan: benar-benar production-safe untuk skala kecil–menengah, bukan sekedar“schema siap”.

## Prinsip

- Tidak melompat sharding sebelum ada bukti butuh.
- Semuanya measurable: KPI per minggu, bukan claim abstrak.
- Negative RLS tests hidup sebagai gate, bukan static review.

## 1. Atasi hot path RLS (penghematan terbesar)

Biggest reverse-lookup:

- `is_class_member()` dipanggil hampir semua policies
- Setiap request menghitung ulang membership tanpa cache

Kerjaan:

- Tambah **request-scope context**: di identity/context middleware simpan `memberships`, `classIds`, `permissions`, valid 30 det.
- Ubah material di middleware navigation, bukan hitung ulang di tiap RPC/query.
- ukur: `explain analyze` di policies berat + log sequential scans dengan `pg_stat_user_indexes`.

Target KPI:

- Polling `is_class_member()` turun ≥90% per request
- Sequential scans < 0.05–0.1% total access (10% user tests)
- Index scans > 95% di hit path

## 2. Index auditing

Tambah di 5G yang sudah ada:

- jangan indeks sembarangan
- Cari duplikat & unused index dorng
- pk indexes berbasis partial
- metrics: index size, hit ratio, bloat
- tool: `pg_stat_user_indexes`, `pg_stat_database`, `pg_statio_user_indexes`

Perlu KPI:

- sequential scans per detik < 0.1% total access
- cache hit > 99%
- buffer cache hit > 99%
- lock waits mengancam < 1% request

## 3. Negative RLS tests hidup

Bukan lagi static review, tapi:

- test `anon denied`
- test `cross-university`
- test `cross-class writes`
- storage signed-url leak check
- RPC `authenticated` cannot write invariant

Automasi: Jest/vitest + ephemeral local stack. Gate release.

## 4. Audit & observasi

- `audit_logs` tunggu: jangan nullable `university_id`
- Tambah immutable trigger `before update/delete`
- Tambah monitored metric: `created_at`, `entity_type`, actor
- Tambah scheduled purge or partition `audit_logs` by month (pg_partman atau simple retention job)
- Tambah dashboard: top auth failures, top slow queries

## 5. Data-flow/sharding prep (belum sekarang)

Pilih nanti dengan kebijakan data:

- Tenant split by DB? schema per-tenant? column legacy fraction?
- Bukan semua cepat perlu sharding; sampai 100–500k rows belum butuh.

## 6. Migration дисциплине

- CI: `supabase migration list --dry-run` + `sqlfluff` + schema parity check
- Pulled request gate: selalu output dry-run report sebagai artifact.
- Jangan push tanpa preflight backup + rollback notes.

## 7. Performance budget

Tetapkan:

- API p95 < 250ms
- DB p95 query < 50ms
- RPC < 100ms
- N+1 = 0 di list page

Kalau tidak lolos budget = stay di development, bukan Production.

## 8. Backfill & enrollment status

Kondisi sekarang:

- 31 membership identity aktif
- classes university-linked
- akademik unit = belum
- offerings = belum
- enrollments = belum

Tanpa itu, front-end menampilkan empty state. Jadi praktis scalable tapi belum ramai.

## Timeline praktis

```text
Minggu 1: RLS profile (<24h) + index audit (<48h) + negative tests
Minggu 2: audit immutable + dashboard observability + admission pipeline
Minggu 3: migrate unit/offering/enrollment data, load-test dengan E2E synthetics
Weekend 4: preproduction soak + tenant-split rehearsal
```

Target: **production-safe at 1000 concurrent + 95% cache hit + zero tenant leaks.**

Dokumen pendukung:

- `docs/architecture/phase-5i/golive-readiness-checklist.md`
- roadmap artikel dan test on Supabase direct

Setiap item harus punya bukti sebelum dicentang:

- output query count
- test pass
- screenshot dashboard
- jangan centang hanya karena sudah dibaca.
