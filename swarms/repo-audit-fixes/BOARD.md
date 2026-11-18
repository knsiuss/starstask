# BOARD

**GOAL:** Memperbaiki seluruh temuan `HIGH` dan `MEDIUM` (serta quick `LOW` fixes) dari `swarms/full-repo-audit/FINAL.md`, memverifikasi semuanya lolos `pnpm lint`, `pnpm typecheck`, `pnpm test`, dan `npx supabase migration up --include-all`, lalu commit dengan Conventional Commits dan merge ke `main`.

**DONE MEANS:**
- **P1 (Web API & Security):** Self-escalation `course_scope` ditutup, `.or()` filter di `classes/lookup` disanitasi, `filterRosterByCourseAccess` fail-closed, 5 endpoint mutasi diberi `enforceRateLimit`, `plugins.ts` & raw error messages dirapikan.
- **P2 (Web UI & Boundaries):** `/developer/observability` dipindah ke `(console)/developer/` dengan allowlist & tanpa `any`, `CallButton`/`StoryRow` bebas `as any`/emoji/`reload()`, `chat-pane.tsx` menangani error mutasi & state `notice`, `course-discussion-thread.tsx` pakai Lucide, `(workspace)/error.tsx` ditambahkan.
- **P3 (SQL & Contracts):** Migrasi `20270131000000_audit_security_and_constraints_fixes.sql` diterapkan ke Supabase lokal; `attendance-sync.ts`, `academic.ts`, dan `profile.ts` diberi batas/presisi sesuai DB.
- **P4 (Mobile & Formatting):** `Integrations.kt` disconnect pakai `POST`, `Calendar.kt` baca `data.eventId`, dan file sumber/migrasi yang belum terformat dirapikan dengan Prettier.
- **Verifikasi & Merge:** Checker independen menyatakan `PASS` untuk `P1..P4`, `pnpm lint`, `pnpm typecheck`, dan `pnpm test` lulus `exit code 0`, lalu di-commit dengan Conventional Commits dan di-merge ke `main` lokal.

**LIMITS:** max 4 concurrent workers, max 2 fix rounds per task, checker selalu worker baru yang berbeda dari author, tanpa force-push atau push ke remote.

---

## RULES FOR EVERYONE

- Format: Ikuti `AGENTS.md` (Prettier, ESLint zero-warning, tanpa `any`, tanpa emoji di UI).
- Style: Commit & merge ke `main` hanya dilakukan oleh coordinator setelah checker menyatakan `PASS` dan seluruh test/lint/typecheck lulus.
- Good sources: `swarms/full-repo-audit/FINAL.md`, `swarms/full-repo-audit/outputs/T1..T4.md`, `AGENTS.md`.
- Out of scope: Full DM E2EE v2 & BAP UI parity di `apps/mobile` (tetap tercatat sebagai backlog terpisah).

---

## DECISIONS

| decision | reason | by |
| :--- | :--- | :--- |
| Commit ke branch lalu merge ke `main` lokal setelah verifikasi | Mengikuti aturan user (`merged ke main` + Conventional Commits) tanpa push ke remote | coordinator |

---

## TASKS

| ID | Owner | Status | Fix rounds | Note |
| :--- | :--- | :--- | :--- | :--- |
| P1 | fix-p1 | done | 0 | Web API, Auth, Rate Limit & Data Hygiene Fixes |
| P2 | fix-p2 | done | 0 | Web UI, Developer Route, Error Boundary & Quality Fixes |
| P3 | fix-p3 | done | 0 | SQL Migration Hardening & Contracts Bounds/Precision Fixes |
| P4 | fix-p4 | done | 0 | Mobile Integrations/Calendar Fixes & Prettier Cleanup |

Status: `open` → `done` → `pass` or `fail`
