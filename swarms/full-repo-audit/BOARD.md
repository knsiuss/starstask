# BOARD

**GOAL:** Melakukan audit menyeluruh pada seluruh repository StarsTask (`apps/web`, `packages/contracts`, `packages/shared`, `supabase/migrations`, dan `apps/mobile`) menggunakan multi-agent swarm, menghasilkan temuan terstruktur dengan bukti file/baris serta prioritas perbaikan di `FINAL.md`.

**DONE MEANS:**
- **T1 (Web API, Auth & Security Audit):** Seluruh route handler di `apps/web/src/app/api/` dan `lib/db/` diaudit untuk auth/RBAC, `createSupabaseAdminClient`, rate limit, input validation, dan kebocoran data/secret; laporan tersimpan di `outputs/T1.md` diakhiri `END`.
- **T2 (Web UI, Pages & Antislop/UX Audit):** Halaman dan komponen di `apps/web/src/app/` dan `components/` diaudit untuk broken routes, loading/error/empty states, client/server boundaries, serta kepatuhan `AGENTS.md`; laporan tersimpan di `outputs/T2.md` diakhiri `END`.
- **T3 (Database Migrations, RLS & Contracts Audit):** `supabase/migrations/`, `packages/contracts/`, dan `packages/shared/` diaudit untuk RLS, `SECURITY DEFINER` RPC (`search_path`, `auth.uid()`), constraint/index, dan sinkronisasi kontrak; laporan tersimpan di `outputs/T3.md` diakhiri `END`.
- **T4 (Mobile Alignment & Build/Test/Lint Verification):** `apps/mobile/` diaudit terhadap kesesuaian API/kontrak web, dan seluruh check repo (`lint`, `typecheck`, `test`, `format:check` pada area terkait) dijalankan; laporan tersimpan di `outputs/T4.md` diakhiri `END`.
- **Verifikasi Checker:** Checker independen memverifikasi seluruh `outputs/T1..T4.md` beserta bukti command/file (`PASS` semua) sebelum `FINAL.md` disusun.

**LIMITS:** max 4 concurrent workers, max 2 fix rounds per task, read-only audit (workers do NOT modify source code — findings only), checker selalu worker baru yang berbeda dari author.

---

## RULES FOR EVERYONE

- Format: Setiap temuan wajib menyertakan `Severity (HIGH / MEDIUM / LOW)`, `File + Line`, `Evidence`, dan `Recommended Fix`.
- Style: Dilarang mengarang atau menebak hasil check; hanya laporkan file, simbol, dan output command yang benar-benar dibaca/dijalankan.
- Good sources: `AGENTS.md`, `apps/web/src/**`, `packages/contracts/**`, `packages/shared/**`, `supabase/migrations/**`, `apps/mobile/**`.
- Out of scope: Mengubah source code aplikasi (audit ini bersifat read-only; perbaikan dilakukan setelah laporan audit disetujui user).

---

## DECISIONS

| decision | reason | by |
| :--- | :--- | :--- |
| Audit read-only tanpa edit source code | Memastikan temuan lengkap dan terprioritaskan sebelum patch | coordinator |

---

## TASKS

| ID | Owner | Status | Fix rounds | Note |
| :--- | :--- | :--- | :--- | :--- |
| T1 | worker-t1 | done | 0 | Web API, Auth, Security & Data Hygiene Audit |
| T2 | worker-t2 | done | 0 | Web UI, Pages, State Handling & Quality Audit |
| T3 | worker-t3 | done | 0 | Supabase Migrations, RLS, RPC & Contracts Audit |
| T4 | worker-t4 | done | 0 | Mobile Alignment & Repo-Wide Lint/Typecheck/Test Audit |

Status: `open` → `done` → `pass` or `fail`
