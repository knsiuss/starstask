# Open Questions

1. What triggers `deadline-reminders`, `notification-events`, `session-jobs` cron routes (not in `vercel.json`)? (Phase 0 check)
2. Are R2 verified quotas (10 GB, egress) current at Phase 4 start? Re-verify against official docs.
3. Does Upstash Redis read-through cache exist end-to-end today? Not verified in this audit.
4. What is measured baseline p95 (Phase 0) for dashboard/action center?
5. Which surfaces still lack pagination caps (F-06 full enumeration)?
6. Is `profile_onboarding` required for every workspace user (drift between anon and member flows)?

Related: README.md · AUDIT: FULL_PLATFORM_PERFORMANCE_AUDIT.md
