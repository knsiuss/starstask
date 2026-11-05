# Resource Requirements & Cost Estimation

Cost objective: IDR 0 additional per month while staying within verified free quotas. Existing (verified): Vercel Hobby, Supabase Free, Upstash free tier. Proposed additions (Phase 4+): Cloudflare R2/DNS/CDN, GitHub Actions, UptimeRobot — all free within quota; first paid trigger = R2 storage overage (10 GB) or Supabase/Vercel upgrade when measured usage exceeds free caps.

## Scenarios (estimates — do not treat as capacity claims)

| Scenario | DB | Storage | Jobs | Cost |
|---|---|---|---|---|
| 1 university, <100 classes, light exports | single Supabase Free instance (500 MB) | <5 GB in R2 | 2 crons + job queue 1/min | IDR 0 |
| 3 universities, moderate exports | Supabase Free + indexes; watch 500 MB | 8–10 GB | job queue + retries | IDR 0 until R2 10 GB |
| 10 universities, heavy OCR/PDF | Supabase paid likely required | >10 GB R2 | job queue saturated | paid trigger reached |

Separate verified quotas (see FREE_TIER_RESOURCE_INVENTORY.md) from estimated requirements and unknown capacity.

Related: README.md · FREE_TIER_COMPARISON.md
