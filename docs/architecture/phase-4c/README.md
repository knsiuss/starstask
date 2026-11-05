# Phase 4C — Architecture Documentation (Read-Only)

> Status: DRAFT (read-only investigation). No production changes made.
> Scope: repository evidence only; no live DB access, no production verification.

## Navigation

| # | File | Purpose |
|---|------|---------|
| 01 | [Repository & Evidence Inventory](./01-repository-and-evidence-inventory.md) | What exists, where, and how it was verified |
| 02 | [Current-State Architecture](./02-current-state-architecture.md) | Baseline verification of prior claims |
| 03 | [Existing Schema Inventory](./03-existing-schema-inventory.md) | 52 tables, 20 attributes each |
| 04 | [Existing Relationship Analysis](./04-existing-relationship-analysis.md) | FK matrix + Mermaid |
| 05 | [Application–Database Mapping](./05-application-database-mapping.md) | Workflows → tables/RPC/RLS |
| 06 | [Product Domain Model](./06-product-domain-model.md) | Domains A–Q overview |
| 07–22 | `07-*` … `22-*` | Per-domain specs (see list below) |
| 23 | [Multi-Tenant Security Architecture](./23-multi-tenant-security-architecture.md) | Tenant classification, FK strategy, lifecycle |
| 24 | [RLS & Function Security Review](./24-rls-and-function-security-review.md) | RLS matrix, is_class_member(), SECURITY DEFINER inventory |
| 25 | [Performance & Scalability](./25-performance-and-scalability.md) | Hot paths, indexes, workload model |
| 26 | [Target Database Schema](./26-target-database-schema.md) | Naming/typing standards + 27-domain specs |
| 27 | [Schema Constraints & Indexes](./27-schema-constraints-and-indexes.md) | Constraints/index strategy |
| 28 | [Entity-Relationship Diagrams](./28-entity-relationship-diagrams.md) | 16 Mermaid ER diagrams |
| 29 | [Existing-to-Target Mapping](./29-existing-to-target-mapping.md) | KEEP/MODIFY/MERGE/SPLIT/DEPRECATE/NEW |
| 30 | [Data Migration Strategy](./30-data-migration-strategy.md) | Expand-contract, risks, rollback |
| 31 | [Application Architecture Alignment](./31-application-architecture-alignment.md) | Responsibility boundaries & patterns |
| 32 | [Testing & Validation Strategy](./32-testing-and-validation-strategy.md) | Integrity/isolation/security/perf tests |
| 33 | [Disaster Recovery & Operations](./33-disaster-recovery-and-operations.md) | Backup, retention, monitoring, incidents |
| 34 | [Architecture Decision Records](./34-architecture-decision-records.md) | ADR-001…ADR-018 |
| 35 | [Implementation Roadmap](./35-implementation-roadmap.md) | Phases 5A–5I |
| 36 | [Open Questions & Assumptions](./36-open-questions-and-assumptions.md) | Unresolved items |
| 37 | [Phase 4C Final Report](./37-phase-4c-final-report.md) | 24-section summary + quality gates |

### Domain docs (07–22)

| File | Domain |
|------|--------|
| `07-global-identity.md` | A — Global identity |
| `08-university-registry-and-tenant-model.md` | B — University registry / tenant lifecycle |
| `09-academic-organization.md` | C — Academic organization (flexible unit model) |
| `10-academic-period.md` | D — Academic period |
| `11-student-identity.md` | E — Student identity (per-university) |
| `12-class-and-membership.md` | F — Class & membership |
| `13-course-catalog-vs-offering-vs-enrollment.md` | G — Course catalog vs offering vs enrollment |
| `14-course-invitation.md` | H — Course invitation (secure tokens) |
| `15-class-administration-rbac.md` | I — Class Admin RBAC |
| `16-assignments.md` | J — Assignments |
| `17-attendance.md` | K — Attendance |
| `18-grading.md` | L — Grading |
| `19-schedule.md` | M — Schedule |
| `20-materials-and-storage.md` | N — Materials / storage |
| `21-social-announcements-discussions.md` | O — Social / announcements / discussions |
| `22-notifications-audit.md` | P/Q — Notifications + Audit |

## Evidence legend

- **CONFIRMED** — user/product decision given in the Phase 4C brief; treat as authoritative.
- **RECOMMENDED** — proposes a specific default, needs owner approval.
- **PROPOSED** — design suggestion, not yet decided.
- **UNRESOLVED** — open question, see `36-open-questions-and-assumptions.md`.
- **VERIFIED** — directly observed in repo files cited.
- **REPORTED** — stated in prior docs (Phase 4A/4B) but not independently re-verified with live DB.
- **UNKNOWN** — cannot be verified from repo evidence alone.

## Safety

This is a documentation-only phase. No migrations were run, no SQL/app code was edited, and nothing was deployed. Only files under `docs/architecture/phase-4c/` were created (see `37-phase-4c-final-report.md`, Gate G).
