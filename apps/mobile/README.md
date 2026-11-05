# StarsTask Mobile (Capacitor)

PWA first, native via Capacitor. Same codebase as web, offline-first.

## Structure

- `src/` — mobile entry (reuse web API + Supabase)
- Offline check-in queue, push via Web Push, E2EE keys in IndexedDB

## Stack

- Capacitor 6 + Vite + TypeScript
- Supabase (same project as web)
- WebCrypto E2EE (same as DM web)

## Commands (dari root repo)

```bash
pnpm --filter @starstask/mobile dev
pnpm --filter @starstask/mobile build
pnpm --filter @starstask/mobile sync  # capacitor sync ios/android
```

## Status

- Scaffolding only (2026-11-05). Fitur prioritas: check-in offline,
  dashboard ringan, notifikasi push.
