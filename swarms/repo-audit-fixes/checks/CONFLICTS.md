# Cross-Task Conflict Check

No conflicts found.

## File Ownership Verification

- **P1 (Web API & DB):** Touched only `apps/web/src/app/api/**`, `apps/web/src/lib/db/course-access.ts`, and `apps/web/src/lib/db/plugins.ts` (11 files).
- **P2 (Web UI & Boundaries):** Touched only `apps/web/src/app/(console)/developer/observability/page.tsx` (created), `apps/web/src/app/(workspace)/developer/observability/page.tsx` (deleted), `apps/web/src/app/(workspace)/error.tsx` (created), `apps/web/src/components/developer/developer-nav.tsx`, `apps/web/src/components/messages/{call-button,story-row,chat-pane}.tsx`, and `apps/web/src/components/classes/course-discussion-thread.tsx`.
- **P3 (SQL & Contracts):** Touched only `supabase/migrations/20270131000000_audit_security_and_constraints_fixes.sql` (created) and `packages/contracts/src/{attendance-sync,academic,profile}.ts`.
- **P4 (Mobile & Prettier):** Touched only `apps/mobile/android/app/src/main/java/id/starstask/mobile/{data/Integrations.kt,data/Calendar.kt,ui/screens/SettingsScreens.kt}` and ran `prettier --write` on the 13 targeted `apps/web/src/` and `supabase/migrations/` files (excluding `20270131000000_*`).

## Cross-Layer Interface Compatibility

- `getObservabilityViews()` (P1, `apps/web/src/lib/db/plugins.ts`) selects `legacy_members, new_memberships, legacy_without_new`, `identities_total, prefixed, unprefixed`, and `source, null_university_rows`, matching the runtime narrowing helpers `toDualWriteDrift`, `toNimDrift`, and `toTenantGapRows` in `apps/web/src/app/(console)/developer/observability/page.tsx` (P2).
- `gradeWeightsSchema` / `attendanceSync` / `classJoinResultSchema` (P3) pass `pnpm typecheck` and `pnpm test` across `packages/contracts` and `apps/web`.
- `Integrations.kt` `disconnectIntegration` (P4) targets `POST /api/integrations/google-calendar/disconnect` and `POST /api/integrations/google-drive/disconnect` with `Authorization: Bearer <token>`, matching the web route contracts.
