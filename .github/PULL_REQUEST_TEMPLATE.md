## Summary

<!-- Describe what this PR changes and why. -->

## Related Issues / Findings

<!-- Link issue numbers or audit items if applicable. -->

## Type of Change

- [ ] Bug fix (`fix`)
- [ ] New feature (`feat`)
- [ ] Security or database hardening (`fix` / `chore`)
- [ ] Documentation (`docs`)
- [ ] Refactor / dependency update (`refactor` / `chore`)

## Verification Checklist

- [ ] `pnpm typecheck` passes with 0 errors
- [ ] `pnpm lint` passes with 0 errors and 0 warnings
- [ ] `pnpm format:check` passes on changed files
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes (for `apps/web` changes)
- [ ] Database migrations (if any) are in a new timestamped file under `supabase/migrations/` and reflected in `database.ts` / `database.generated.ts`
- [ ] No secrets, `.env*` files, or personal user data are included in the diff
