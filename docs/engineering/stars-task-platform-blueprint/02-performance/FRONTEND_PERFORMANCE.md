# Frontend Performance

Confirmed patterns (this session + prior component reads):

- Server Components by default; client islands are bounded (`class-attendance-workspace`, `attendance-meeting-form`, `workspace-panel-stack`). Do not convert everything to client components.
- Bundle weight drivers: `exceljs`, `pdf-lib`, `unpdf` (document pipelines), `jspdf` absent; `lucide-react` many icons but tree-shaken — verify bundle budget (§10 targets).
- Loading states: skeleton files exist for dashboard and attendance (added this epic). Remaining gaps: some empty states and specialized panels.
- Polling: session panel fetches detail on open (single fetch); no broad polling observed — keep single-fetch + on-open refresh.
- Actions: `router.refresh()` observed in attendance flow; replace with targeted invalidation where possible (Phase 2).

Targets (§10): LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. Measure via Playwright + Lighthouse CI (free, Phase 0).

Related: README.md · FULL_PLATFORM_PERFORMANCE_AUDIT.md
