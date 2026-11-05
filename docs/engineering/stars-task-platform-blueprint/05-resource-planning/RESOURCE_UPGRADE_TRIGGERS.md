# Resource Upgrade Triggers

| Trigger metric (verified source) | Action |
|---|---|
| Supabase DB > 80% free quota or MAU approaching cap | evaluate Supabase paid (document cost) |
| Vercel bandwidth/function duration exceeded | exports to background jobs (Phase 4) before paid upgrade |
| R2 storage > 10 GB | pay R2 overage or prune orphan objects |
| Upstash requests > 80% quota | selective cache expansion |
| cron latency p95 > 30s | split heavy jobs into worker queue |
| p95 TTFB > 800ms on dashboard/action center sustained 7d | Phase 1 RPC aggregation + cache |
| Any security incident from RLS gap | freeze + patch, no perf exception |

Related: README.md · RESOURCE_REQUIREMENTS_AND_COST_ESTIMATION.md
