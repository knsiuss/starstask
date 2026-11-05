# Resource Utilization Matrix

Current usage is **unmeasured** in this audit (no production metrics access).

| Resource | Verified quota | Measured usage | Estimated need | Unknown capacity |
|---|---|---|---|---|
| Supabase DB | 500 MB | unknown | index sweep first | row growth rate |
| Vercel bandwidth | Hobby cap | unknown | n/a | peak concurrency |
| R2 storage | 10 GB | 0 (not adopted) | 2–5 GB initial | upload growth |
| Upstash req | 500k/day | unknown | — | — |
| Cron minutes | Hobby | 2 jobs verified | +1/min job runner | — |

Phase 0 must instrument before any scaling claim.

Related: README.md · INFRASTRUCTURE_LIMITATIONS.md
