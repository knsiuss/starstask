# Infrastructure Limitations

- Vercel Hobby: serverless function timeout ~10s (verify at Phase 0) → synchronous exports/OCR will fail at scale; hence background jobs (Phase 4).
- Supabase Free: 500 MB DB, 1 GB storage, 50k MAU, connection limits; RLS-heavy queries scale linearly until indexes land.
- Upstash free request cap; cache before expanding.
- R2 free 10 GB storage cap; beyond = first honest paid line item.
- Cron: only 2 vercel.json entries verified; 3 extra cron routes' trigger mechanism unverified (open question §OPEN_QUESTIONS).
- No measured load envelope exists; do not claim 1k+ concurrency.

Related: README.md · RESOURCE_UPGRADE_TRIGGERS.md
